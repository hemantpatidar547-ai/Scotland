import 'server-only';

import { randomUUID } from 'node:crypto';
import type { RefundEntity } from 'cashfree-pg';
import { getCashfreeClient } from '@/lib/cashfree';
import { getSupabaseAdmin } from '@/lib/supabase/db';

type CheckoutSession = {
    id: string;
    cashfree_order_id: string;
    amount: number;
    order_id: string | null;
};

type RefundRecord = {
    id: string;
    merchant_refund_id: string;
    idempotency_key: string;
    amount: number;
    status: string;
};

function isFinalFailure ( status: string )
{
    return [ 'FAILED', 'CANCELLED', 'REJECTED' ].includes( status.toUpperCase() );
}

export async function applyCashfreeRefundStatus (
    refundRecordId: string,
    sessionId: string,
    providerRefund: RefundEntity
)
{
    const db = getSupabaseAdmin();
    const status = String( providerRefund.refund_status || 'PENDING' ).toUpperCase();
    const { error: refundError } = await db.from( 'cashfree_refunds' )
        .update( {
            cf_refund_id: providerRefund.cf_refund_id ? String( providerRefund.cf_refund_id ) : null,
            status,
            refund_arn: providerRefund.refund_arn || null,
            provider_payload: providerRefund,
            processed_at: providerRefund.processed_at || null,
            updated_at: new Date().toISOString(),
        } )
        .eq( 'id', refundRecordId );
    if ( refundError ) throw refundError;

    const { data: session, error: sessionError } = await db.from( 'cashfree_checkout_sessions' )
        .select( 'id, amount, order_id, status' )
        .eq( 'id', sessionId )
        .single();
    if ( sessionError ) throw sessionError;

    const { data: successfulRefunds, error: sumError } = await db.from( 'cashfree_refunds' )
        .select( 'amount' )
        .eq( 'checkout_session_id', sessionId )
        .eq( 'status', 'SUCCESS' );
    if ( sumError ) throw sumError;
    const confirmedAmount = ( successfulRefunds || [] )
        .reduce( ( sum: number, refund: { amount: number | string } ) => sum + Number( refund.amount ), 0 );
    const totalPaid = Number( session.amount );
    const fullyRefunded = confirmedAmount >= totalPaid - 0.005;

    const sessionPaymentStatus = fullyRefunded
        ? 'refunded'
        : session.status === 'refund_required' && confirmedAmount === 0
            ? 'refund_required'
            : confirmedAmount > 0
                ? 'partially_refunded'
                : 'paid';
    const { error: updateSessionError } = await db.from( 'cashfree_checkout_sessions' )
        .update( {
            status: fullyRefunded ? 'refunded' : session.status === 'refund_required' ? 'refund_required' : 'paid',
            payment_status: sessionPaymentStatus,
            updated_at: new Date().toISOString(),
        } )
        .eq( 'id', sessionId );
    if ( updateSessionError ) throw updateSessionError;

    if ( session.order_id )
    {
        const { error: orderError } = await db.from( 'orders' )
            .update( {
                payment_status: fullyRefunded
                    ? 'refunded'
                    : session.status === 'refund_required' && confirmedAmount === 0
                        ? 'refund_required'
                        : confirmedAmount > 0
                            ? 'partially_refunded'
                            : 'paid',
                cashfree_refund_amount: confirmedAmount,
                cashfree_refund_status: status,
                updated_at: new Date().toISOString(),
            } )
            .eq( 'id', session.order_id );
        if ( orderError ) throw orderError;
    }

    return { status, confirmedAmount, fullyRefunded, isFinalFailure: isFinalFailure( status ) };
}

export async function submitCashfreeRefund (
    session: CheckoutSession,
    refund: RefundRecord,
    note: string
)
{
    const client = getCashfreeClient();
    const response = await client.PGOrderCreateRefund(
        session.cashfree_order_id,
        {
            refund_id: refund.merchant_refund_id,
            refund_amount: Number( refund.amount ),
            refund_note: note.slice( 0, 200 ),
        },
        randomUUID(),
        refund.idempotency_key
    );

    return applyCashfreeRefundStatus( refund.id, session.id, response.data );
}

export async function reconcileCashfreeRefunds ( session: CheckoutSession )
{
    const client = getCashfreeClient();
    const { data: providerRefunds } = await client.PGOrderFetchRefunds( session.cashfree_order_id );
    const db = getSupabaseAdmin();
    const observedRefundIds = new Set<string>();

    for ( const providerRefund of providerRefunds )
    {
        const merchantRefundId = providerRefund.refund_id || (
            providerRefund.cf_refund_id ? `cashfree_${ providerRefund.cf_refund_id }` : ''
        );
        if ( !merchantRefundId ) continue;
        observedRefundIds.add( merchantRefundId );

        let { data: refund, error } = await db.from( 'cashfree_refunds' )
            .select( 'id' )
            .eq( 'merchant_refund_id', merchantRefundId )
            .maybeSingle();
        if ( error ) throw error;

        if ( !refund )
        {
            const { data: inserted, error: insertError } = await db.from( 'cashfree_refunds' )
                .insert( {
                    checkout_session_id: session.id,
                    order_id: session.order_id,
                    merchant_refund_id: merchantRefundId,
                    cf_refund_id: providerRefund.cf_refund_id ? String( providerRefund.cf_refund_id ) : null,
                    idempotency_key: randomUUID(),
                    amount: Number( providerRefund.refund_amount || 0 ),
                    status: String( providerRefund.refund_status || 'PENDING' ),
                    note: providerRefund.refund_note || null,
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
                    .eq( 'merchant_refund_id', merchantRefundId )
                    .single();
                if ( retry.error ) throw retry.error;
                refund = retry.data;
            } else
            {
                if ( insertError ) throw insertError;
                refund = inserted;
            }
        }

        await applyCashfreeRefundStatus( refund.id, session.id, providerRefund );
    }

    const { data: initiatingRefunds, error: initiatingError } = await db.from( 'cashfree_refunds' )
        .select( 'id, merchant_refund_id, idempotency_key, amount, status' )
        .eq( 'checkout_session_id', session.id )
        .eq( 'requested_by', 'system' )
        .eq( 'status', 'INITIATING' );
    if ( initiatingError ) throw initiatingError;

    for ( const refund of initiatingRefunds || [] )
    {
        if ( observedRefundIds.has( refund.merchant_refund_id ) ) continue;
        await submitCashfreeRefund( session, refund, 'Automatic refund because the paid order could not be fulfilled.' );
    }
}

export async function initiateCashfreeStockFailureRefund (
    session: CheckoutSession,
    reason: string
)
{
    const db = getSupabaseAdmin();
    const { error: sessionUpdateError } = await db.from( 'cashfree_checkout_sessions' )
        .update( {
            status: 'refund_required',
            payment_status: 'refund_required',
            failure_reason: reason.slice( 0, 500 ),
            updated_at: new Date().toISOString(),
        } )
        .eq( 'id', session.id );
    if ( sessionUpdateError ) throw sessionUpdateError;

    let { data: refund, error } = await db.from( 'cashfree_refunds' )
        .select( 'id, merchant_refund_id, idempotency_key, amount, status' )
        .eq( 'checkout_session_id', session.id )
        .eq( 'requested_by', 'system' )
        .maybeSingle();

    if ( error ) throw error;
    if ( !refund )
    {
        const { data: inserted, error: insertError } = await db.from( 'cashfree_refunds' )
            .insert( {
                checkout_session_id: session.id,
                merchant_refund_id: `auto${ session.id.replaceAll( '-', '' ) }`,
                idempotency_key: randomUUID(),
                amount: Number( session.amount ),
                status: 'INITIATING',
                note: reason.slice( 0, 200 ),
                requested_by: 'system',
            } )
            .select( 'id, merchant_refund_id, idempotency_key, amount, status' )
            .single();

        if ( insertError?.code === '23505' )
        {
            const retry = await db.from( 'cashfree_refunds' )
                .select( 'id, merchant_refund_id, idempotency_key, amount, status' )
                .eq( 'checkout_session_id', session.id )
                .eq( 'requested_by', 'system' )
                .single();
            if ( retry.error ) throw retry.error;
            refund = retry.data;
        } else
        {
            if ( insertError ) throw insertError;
            refund = inserted;
        }
    }

    if ( refund.status === 'SUCCESS' ) return;
    try
    {
        await submitCashfreeRefund( session, refund, reason );
    } catch ( error )
    {
        console.error( 'Cashfree automatic refund could not be confirmed:', error );
        const { error: persistError } = await db.from( 'cashfree_refunds' )
            .update( {
                status: 'INITIATING',
                updated_at: new Date().toISOString(),
            } )
            .eq( 'id', refund.id );
        if ( persistError ) throw persistError;
    }
}
