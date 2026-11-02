import 'server-only';

import type { OrderEntity, PaymentEntity } from 'cashfree-pg';
import { getCashfreeClient } from '@/lib/cashfree';
import { initiateCashfreeStockFailureRefund } from '@/lib/cashfree-refunds';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { bustProductCache } from '@/lib/data';

export type CashfreeCheckoutResult = {
    status: 'paid' | 'pending' | 'failed' | 'refund_required';
    orderNumber?: string;
};

function isSameMoney ( first: number, second: number )
{
    return Number.isFinite( first ) && Math.round( first * 100 ) === Math.round( second * 100 );
}

function getTransactionId ( payment: PaymentEntity )
{
    return payment.bank_reference || payment.payment_gateway_details?.gateway_payment_id ||
        payment.auth_id || payment.cf_payment_id || null;
}

async function savePaymentAttempts ( checkoutSessionId: string, payments: PaymentEntity[] )
{
    const db = getSupabaseAdmin();
    const attempts = payments.flatMap( payment =>
    {
        if ( !payment.cf_payment_id ) return [];
        return [ {
            checkout_session_id: checkoutSessionId,
            cf_payment_id: String( payment.cf_payment_id ),
            payment_status: String( payment.payment_status || 'PENDING' ),
            payment_amount: payment.payment_amount ?? null,
            payment_currency: payment.payment_currency || payment.order_currency || null,
            payment_method: payment.payment_group || null,
            transaction_id: getTransactionId( payment ),
            bank_reference: payment.bank_reference || null,
            payment_time: payment.payment_time || null,
            payment_completion_time: payment.payment_completion_time || null,
            payment_message: payment.payment_message || null,
            provider_payload: {
                cf_payment_id: String( payment.cf_payment_id ),
                order_id: payment.order_id || null,
                payment_status: payment.payment_status || null,
                payment_amount: payment.payment_amount ?? null,
                payment_currency: payment.payment_currency || payment.order_currency || null,
                payment_group: payment.payment_group || null,
                bank_reference: payment.bank_reference || null,
                gateway_payment_id: payment.payment_gateway_details?.gateway_payment_id || null,
                payment_message: payment.payment_message || null,
            },
            updated_at: new Date().toISOString(),
        } ];
    } );
    if ( !attempts.length ) return;

    const { error } = await db.from( 'cashfree_payment_transactions' )
        .upsert( attempts, { onConflict: 'cf_payment_id' } );
    if ( error ) throw error;
}

export async function syncCashfreeCheckout ( cashfreeOrderId: string ): Promise<CashfreeCheckoutResult>
{
    const db = getSupabaseAdmin();
    const { data: session, error: sessionError } = await db.from( 'cashfree_checkout_sessions' )
        .select( '*' )
        .eq( 'cashfree_order_id', cashfreeOrderId )
        .maybeSingle();
    if ( sessionError ) throw sessionError;
    if ( !session ) throw new Error( 'Cashfree checkout session was not found.' );

    if ( session.status === 'refund_required' )
        return { status: 'refund_required' };

    if ( session.order_id )
    {
        const { data: order, error } = await db.from( 'orders' )
            .select( 'order_number' )
            .eq( 'id', session.order_id )
            .single();
        if ( error ) throw error;
        return { status: 'paid', orderNumber: order.order_number };
    }

    const client = getCashfreeClient();
    const [ providerOrderResult, paymentResult ] = await Promise.all( [
        client.PGFetchOrder( cashfreeOrderId ),
        client.PGOrderFetchPayments( cashfreeOrderId ),
    ] );
    const providerOrder: OrderEntity = providerOrderResult.data;
    const payments: PaymentEntity[] = paymentResult.data || [];

    if ( providerOrder.order_id !== session.cashfree_order_id ||
        providerOrder.order_currency !== session.currency ||
        !isSameMoney( Number( providerOrder.order_amount ), Number( session.amount ) ) )
    {
        throw new Error( 'Cashfree order details do not match the saved checkout amount.' );
    }
    await savePaymentAttempts( session.id, payments );

    if ( providerOrder.order_status === 'PAID' )
    {
        const successfulPayment = payments.find( payment =>
            payment.payment_status === 'SUCCESS' &&
            payment.order_id === session.cashfree_order_id
        );
        if ( !successfulPayment || !successfulPayment.cf_payment_id ||
            successfulPayment.payment_currency !== session.currency ||
            !isSameMoney( Number( successfulPayment.payment_amount ), Number( session.amount ) ) )
        {
            throw new Error( 'Cashfree has not confirmed a matching successful payment yet.' );
        }

        const { data: finalized, error: finalizeError } = await db.rpc( 'complete_cashfree_checkout', {
            p_checkout_session_id: session.id,
            p_cf_payment_id: String( successfulPayment.cf_payment_id ),
            p_payment_method: successfulPayment.payment_group || 'unknown',
            p_transaction_id: getTransactionId( successfulPayment ),
            p_payment_date: successfulPayment.payment_completion_time || successfulPayment.payment_time || null,
            p_payment_amount: Number( successfulPayment.payment_amount ),
            p_currency: successfulPayment.payment_currency,
        } );

        if ( finalizeError )
        {
            const message = finalizeError.message.toLowerCase();
            if ( message.includes( 'insufficient stock' ) || message.includes( 'orders are temporarily paused' ) )
            {
                const reason = message.includes( 'insufficient stock' )
                    ? 'Automatic refund because the requested inventory is no longer available.'
                    : 'Automatic refund because order processing was paused before payment confirmation.';
                const { data: refundRequired, error: refundRequiredError } = await db.rpc( 'record_cashfree_refund_required', {
                    p_checkout_session_id: session.id,
                    p_cf_payment_id: String( successfulPayment.cf_payment_id ),
                    p_payment_method: successfulPayment.payment_group || 'unknown',
                    p_transaction_id: getTransactionId( successfulPayment ),
                    p_payment_date: successfulPayment.payment_completion_time || successfulPayment.payment_time || null,
                    p_payment_amount: Number( successfulPayment.payment_amount ),
                    p_currency: successfulPayment.payment_currency,
                    p_failure_reason: reason,
                } );
                if ( refundRequiredError ) throw refundRequiredError;
                const failedOrder = Array.isArray( refundRequired ) ? refundRequired[ 0 ] : refundRequired;
                const { data: refundSession, error: refundSessionError } = await db.from( 'cashfree_checkout_sessions' )
                    .select( 'id, cashfree_order_id, amount, order_id' )
                    .eq( 'id', session.id )
                    .single();
                if ( refundSessionError ) throw refundSessionError;
                if ( !failedOrder?.order_id && !refundSession.order_id )
                    throw new Error( 'Could not save the paid order that requires an automatic refund.' );

                await initiateCashfreeStockFailureRefund(
                    refundSession,
                    reason
                );
                bustProductCache();
                return { status: 'refund_required' };
            }
            throw finalizeError;
        }

        const { data: finalizedSession, error: finalizedSessionError } = await db.from( 'cashfree_checkout_sessions' )
            .select( 'status, order_id' )
            .eq( 'id', session.id )
            .single();
        if ( finalizedSessionError ) throw finalizedSessionError;
        if ( finalizedSession.status === 'refund_required' )
            return { status: 'refund_required' };

        const order = Array.isArray( finalized ) ? finalized[ 0 ] : finalized;
        if ( !order?.order_id )
        {
            const { data: currentSession, error } = await db.from( 'cashfree_checkout_sessions' )
                .select( 'order_id' )
                .eq( 'id', session.id )
                .single();
            if ( error ) throw error;
            if ( !currentSession.order_id ) throw new Error( 'Cashfree payment was verified but no order was created.' );
            const { data: currentOrder, error: orderError } = await db.from( 'orders' )
                .select( 'order_number' )
                .eq( 'id', currentSession.order_id )
                .single();
            if ( orderError ) throw orderError;
            return { status: 'paid', orderNumber: currentOrder.order_number };
        }

        const { data: savedOrder, error: orderError } = await db.from( 'orders' )
            .select( 'order_number' )
            .eq( 'id', order.order_id )
            .single();
        if ( orderError ) throw orderError;
        return { status: 'paid', orderNumber: savedOrder.order_number };
    }

    if ( providerOrder.order_status === 'EXPIRED' || providerOrder.order_status === 'TERMINATED' )
    {
        const { error } = await db.from( 'cashfree_checkout_sessions' )
            .update( {
                status: 'expired',
                payment_status: 'failed',
                failure_reason: 'Cashfree payment session expired without a successful payment.',
                updated_at: new Date().toISOString(),
            } )
            .eq( 'id', session.id )
            .is( 'order_id', null );
        if ( error ) throw error;
        return { status: 'failed' };
    }

    const latestAttempt = [ ...payments ].sort( ( left, right ) =>
        Date.parse( right.payment_time || '' ) - Date.parse( left.payment_time || '' )
    )[ 0 ];
    const failed = [ 'FAILED', 'USER_DROPPED', 'CANCELLED', 'VOID' ].includes( latestAttempt?.payment_status || '' );
    if ( failed )
    {
        const { error } = await db.from( 'cashfree_checkout_sessions' )
            .update( {
                payment_status: 'failed',
                failure_reason: latestAttempt.payment_message || latestAttempt.payment_status || 'Cashfree payment failed.',
                updated_at: new Date().toISOString(),
            } )
            .eq( 'id', session.id )
            .is( 'order_id', null );
        if ( error ) throw error;
    }
    return {
        status: failed ? 'failed' : 'pending',
    };
}
