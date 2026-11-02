import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { isAdminRequest } from '@/lib/admin-auth';
import { syncCashfreeCheckout } from '@/lib/cashfree-payment';
import { reconcileCashfreeRefunds } from '@/lib/cashfree-refunds';

export async function GET ( _request: NextRequest, { params }: { params: Promise<{ id: string }> } )
{
    try
    {
        if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
        const { id } = await params;
        const db = getSupabaseAdmin();
        const { data: order, error: orderError } = await db.from( 'orders' )
            .select( 'id, payment_method, payment_status, cashfree_checkout_session_id, cashfree_order_id, cashfree_payment_id, cashfree_payment_method, cashfree_transaction_id, cashfree_payment_date, cashfree_refund_status, cashfree_refund_amount, final_amount' )
            .eq( 'id', id )
            .maybeSingle();
        if ( orderError ) throw orderError;
        if ( !order ) return NextResponse.json( { error: 'Order not found.' }, { status: 404 } );
        if ( !order.cashfree_checkout_session_id )
            return NextResponse.json( { error: 'This order does not have a Cashfree payment.' }, { status: 409 } );

        let reconciliationWarning: string | null = null;
        try
        {
            await syncCashfreeCheckout( order.cashfree_order_id );
            const { data: session, error: sessionError } = await db.from( 'cashfree_checkout_sessions' )
                .select( 'id, cashfree_order_id, amount, order_id' )
                .eq( 'id', order.cashfree_checkout_session_id )
                .single();
            if ( sessionError ) throw sessionError;
            await reconcileCashfreeRefunds( session );
        } catch ( error )
        {
            console.error( 'Cashfree provider reconciliation failed while loading admin payment details:', error );
            reconciliationWarning = 'Could not refresh the latest provider status. Showing the saved payment and refund history.';
        }

        const { data: currentOrder, error: currentOrderError } = await db.from( 'orders' )
            .select( 'payment_method, payment_status, cashfree_order_id, cashfree_payment_id, cashfree_payment_method, cashfree_transaction_id, cashfree_payment_date, cashfree_refund_status, cashfree_refund_amount, final_amount' )
            .eq( 'id', id )
            .single();
        if ( currentOrderError ) throw currentOrderError;

        const [ transactionResult, refundResult ] = await Promise.all( [
            db.from( 'cashfree_payment_transactions' )
                .select( 'cf_payment_id, payment_status, payment_amount, payment_currency, payment_method, transaction_id, bank_reference, payment_time, payment_completion_time, payment_message' )
                .eq( 'checkout_session_id', order.cashfree_checkout_session_id )
                .order( 'created_at', { ascending: false } ),
            db.from( 'cashfree_refunds' )
                .select( 'merchant_refund_id, cf_refund_id, amount, status, note, refund_arn, created_at, processed_at' )
                .eq( 'checkout_session_id', order.cashfree_checkout_session_id )
                .order( 'created_at', { ascending: false } ),
        ] );
        if ( transactionResult.error ) throw transactionResult.error;
        if ( refundResult.error ) throw refundResult.error;

        return NextResponse.json( {
            payment: {
                provider: 'Cashfree',
                status: currentOrder.payment_status,
                cashfreeOrderId: currentOrder.cashfree_order_id,
                paymentId: currentOrder.cashfree_payment_id,
                paymentMethod: currentOrder.cashfree_payment_method,
                transactionId: currentOrder.cashfree_transaction_id,
                paymentDate: currentOrder.cashfree_payment_date,
                paymentAmount: currentOrder.final_amount,
                refundStatus: currentOrder.cashfree_refund_status,
                refundedAmount: currentOrder.cashfree_refund_amount,
                reconciliationWarning,
                transactions: transactionResult.data || [],
                refunds: refundResult.data || [],
            },
        } );
    } catch ( error )
    {
        console.error( 'Admin Cashfree payment details failed:', error );
        return NextResponse.json( { error: 'Could not load Cashfree payment details.' }, { status: 500 } );
    }
}
