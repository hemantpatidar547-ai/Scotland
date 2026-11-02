import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { RefundEntity } from 'cashfree-pg';
import { getCashfreeClient } from '@/lib/cashfree';
import { syncCashfreeCheckout } from '@/lib/cashfree-payment';
import { applyCashfreeRefundStatus } from '@/lib/cashfree-refunds';
import { getSupabaseAdmin } from '@/lib/supabase/db';

export const runtime = 'nodejs';

type JsonRecord = Record<string, unknown>;

function isRecord ( value: unknown ): value is JsonRecord
{
    return Boolean( value && typeof value === 'object' && !Array.isArray( value ) );
}

function asString ( value: unknown )
{
    return typeof value === 'string' || typeof value === 'number' ? String( value ) : '';
}

function getAuditPayload ( event: JsonRecord )
{
    const data = isRecord( event.data ) ? event.data : {};
    const payment = isRecord( data.payment ) ? data.payment : {};
    const order = isRecord( data.order ) ? data.order : {};
    const refund = isRecord( data.refund )
        ? data.refund
        : isRecord( data.auto_refund )
            ? data.auto_refund
            : {};

    return {
        type: asString( event.type ),
        event_time: asString( event.event_time ),
        order: {
            order_id: asString( order.order_id || refund.order_id ),
            order_amount: order.order_amount ?? null,
            order_currency: asString( order.order_currency ),
        },
        payment: {
            cf_payment_id: asString( payment.cf_payment_id || refund.cf_payment_id ),
            payment_status: asString( payment.payment_status ),
            payment_amount: payment.payment_amount ?? null,
            payment_currency: asString( payment.payment_currency ),
            payment_group: asString( payment.payment_group ),
            bank_reference: asString( payment.bank_reference ),
        },
        refund: {
            cf_refund_id: asString( refund.cf_refund_id ),
            refund_id: asString( refund.refund_id ),
            refund_status: asString( refund.refund_status ),
            refund_amount: refund.refund_amount ?? null,
            refund_arn: asString( refund.refund_arn ),
        },
    };
}

async function handleRefundEvent ( event: JsonRecord )
{
    const data = isRecord( event.data ) ? event.data : {};
    const refundData = isRecord( data.refund )
        ? data.refund
        : isRecord( data.auto_refund )
            ? data.auto_refund
            : null;
    if ( !refundData ) return;

    const cashfreeOrderId = asString( refundData.order_id );
    const merchantRefundId = asString( refundData.refund_id );
    const cashfreeRefundId = asString( refundData.cf_refund_id );
    if ( !cashfreeOrderId ) return;

    const db = getSupabaseAdmin();
    const { data: session, error: sessionError } = await db.from( 'cashfree_checkout_sessions' )
        .select( 'id, cashfree_order_id, amount, order_id' )
        .eq( 'cashfree_order_id', cashfreeOrderId )
        .maybeSingle();
    if ( sessionError ) throw sessionError;
    if ( !session ) return;

    const client = getCashfreeClient();
    const { data: providerRefunds } = await client.PGOrderFetchRefunds( cashfreeOrderId );
    const providerRefund = providerRefunds.find( refund =>
        ( merchantRefundId && refund.refund_id === merchantRefundId ) ||
        ( cashfreeRefundId && String( refund.cf_refund_id ) === cashfreeRefundId )
    );
    if ( !providerRefund ) throw new Error( 'Cashfree refund is not available for verification yet.' );

    let { data: savedRefund, error: refundReadError } = await db.from( 'cashfree_refunds' )
        .select( 'id' )
        .eq( 'merchant_refund_id', providerRefund.refund_id || merchantRefundId )
        .maybeSingle();
    if ( refundReadError ) throw refundReadError;

    if ( !savedRefund )
    {
        const { data: inserted, error: insertError } = await db.from( 'cashfree_refunds' )
            .insert( {
                checkout_session_id: session.id,
                order_id: session.order_id,
                merchant_refund_id: providerRefund.refund_id || `cashfree_${ cashfreeRefundId }`,
                cf_refund_id: providerRefund.cf_refund_id ? String( providerRefund.cf_refund_id ) : null,
                idempotency_key: randomUUID(),
                amount: Number( providerRefund.refund_amount || refundData.refund_amount || 0 ),
                status: String( providerRefund.refund_status || 'PENDING' ),
                note: providerRefund.refund_note || 'Cashfree automatic refund',
                requested_by: 'cashfree',
                provider_payload: providerRefund,
                processed_at: providerRefund.processed_at || null,
            } )
            .select( 'id' )
            .single();
        if ( insertError?.code === '23505' )
        {
            const retry = await db.from( 'cashfree_refunds' )
                .select( 'id' )
                .eq( 'merchant_refund_id', providerRefund.refund_id || `cashfree_${ cashfreeRefundId }` )
                .single();
            if ( retry.error ) throw retry.error;
            savedRefund = retry.data;
        } else
        {
            if ( insertError ) throw insertError;
            savedRefund = inserted;
        }
    }

    await applyCashfreeRefundStatus( savedRefund.id, session.id, providerRefund as RefundEntity );
}

export async function POST ( request: NextRequest )
{
    const rawBody = await request.text();
    const signature = request.headers.get( 'x-webhook-signature' );
    const timestamp = request.headers.get( 'x-webhook-timestamp' );
    if ( !signature || !timestamp )
        return NextResponse.json( { error: 'Missing Cashfree webhook signature headers.' }, { status: 400 } );

    let event: JsonRecord;
    try
    {
        const client = getCashfreeClient();
        client.PGVerifyWebhookSignature( signature, rawBody, timestamp );
        const parsed: unknown = JSON.parse( rawBody );
        if ( !isRecord( parsed ) ) throw new Error( 'Invalid webhook payload.' );
        event = parsed;
    } catch ( error )
    {
        console.error( 'Cashfree webhook signature or payload validation failed:', error );
        return NextResponse.json( { error: 'Invalid Cashfree webhook.' }, { status: 400 } );
    }

    const eventType = asString( event.type ) || 'UNKNOWN';
    const eventKey = request.headers.get( 'x-idempotency-key' )
        || request.headers.get( 'x-idempotency-header' )
        || createHash( 'sha256' ).update( `${ timestamp }.${ rawBody }` ).digest( 'hex' );
    const db = getSupabaseAdmin();

    try
    {
        const { error: logError } = await db.from( 'cashfree_webhook_events' )
            .upsert( {
                event_key: eventKey,
                event_type: eventType,
                payload: getAuditPayload( event ),
                processing_error: null,
                received_at: new Date().toISOString(),
            }, { onConflict: 'event_key', ignoreDuplicates: true } );
        if ( logError ) throw logError;

        if ( eventType.startsWith( 'PAYMENT_' ) )
        {
            const data = isRecord( event.data ) ? event.data : {};
            const order = isRecord( data.order ) ? data.order : {};
            const orderId = asString( order.order_id );
            if ( orderId ) await syncCashfreeCheckout( orderId );
        } else if ( eventType.includes( 'REFUND' ) )
        {
            await handleRefundEvent( event );
        }

        const { error: processedError } = await db.from( 'cashfree_webhook_events' )
            .update( { processed_at: new Date().toISOString(), processing_error: null } )
            .eq( 'event_key', eventKey );
        if ( processedError ) throw processedError;
        return NextResponse.json( { received: true } );
    } catch ( error )
    {
        console.error( 'Cashfree webhook processing failed:', error );
        const { error: persistError } = await db.from( 'cashfree_webhook_events' )
            .update( { processing_error: 'Webhook processing failed; Cashfree may retry.' } )
            .eq( 'event_key', eventKey );
        if ( persistError ) console.error( 'Could not save Cashfree webhook processing error:', persistError );
        return NextResponse.json( { error: 'Webhook processing failed.' }, { status: 500 } );
    }
}
