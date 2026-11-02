import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { isAdminRequest } from '@/lib/admin-auth';
import { submitCashfreeRefund } from '@/lib/cashfree-refunds';

const refundSchema = z.object( {
    amount: z.number().positive().max( 10000000 ),
    idempotencyKey: z.string().uuid(),
    note: z.string().trim().max( 200 ).default( '' ),
} );

export async function POST ( request: NextRequest, { params }: { params: Promise<{ id: string }> } )
{
    try
    {
        if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
        const origin = request.headers.get( 'origin' );
        if ( origin && origin !== request.nextUrl.origin )
            return NextResponse.json( { error: 'Invalid request origin.' }, { status: 403 } );

        const parsed = refundSchema.safeParse( await request.json() );
        if ( !parsed.success )
            return NextResponse.json( { error: 'Enter a valid refund amount and request key.' }, { status: 400 } );

        const { id: orderId } = await params;
        const db = getSupabaseAdmin();
        const { data: order, error: orderError } = await db.from( 'orders' )
            .select( 'id, payment_method, payment_status, cashfree_checkout_session_id' )
            .eq( 'id', orderId )
            .maybeSingle();
        if ( orderError ) throw orderError;
        if ( !order ) return NextResponse.json( { error: 'Order not found.' }, { status: 404 } );
        if ( order.payment_method !== 'cashfree' || !order.cashfree_checkout_session_id )
            return NextResponse.json( { error: 'Only Cashfree payments can be refunded here.' }, { status: 409 } );
        if ( ![ 'paid', 'partially_refunded' ].includes( order.payment_status ) )
            return NextResponse.json( { error: 'Only successfully paid orders can be refunded.' }, { status: 409 } );

        const { data: reservation, error: reservationError } = await db.rpc( 'reserve_cashfree_refund', {
            p_checkout_session_id: order.cashfree_checkout_session_id,
            p_amount: Math.round( parsed.data.amount * 100 ) / 100,
            p_idempotency_key: parsed.data.idempotencyKey,
            p_note: parsed.data.note,
            p_requested_by: process.env.ADMIN_EMAIL || 'admin',
        } );
        if ( reservationError )
        {
            const message = reservationError.message.toLowerCase();
            if ( message.includes( 'refund amount' ) || message.includes( 'only a paid' ) ||
                message.includes( 'idempotency key' ) )
                return NextResponse.json( { error: reservationError.message }, { status: 409 } );
            throw reservationError;
        }
        const reserved = Array.isArray( reservation ) ? reservation[ 0 ] : reservation;
        if ( !reserved?.refund_record_id )
            throw new Error( 'Refund reservation did not return a record.' );

        const { data: refund, error: refundError } = await db.from( 'cashfree_refunds' )
            .select( 'id, merchant_refund_id, idempotency_key, amount, status, note, checkout_session_id' )
            .eq( 'id', reserved.refund_record_id )
            .single();
        if ( refundError ) throw refundError;

        const { data: session, error: sessionError } = await db.from( 'cashfree_checkout_sessions' )
            .select( 'id, cashfree_order_id, amount, order_id' )
            .eq( 'id', refund.checkout_session_id )
            .single();
        if ( sessionError ) throw sessionError;

        const result = await submitCashfreeRefund(
            session,
            refund,
            refund.note || parsed.data.note || 'Admin initiated refund'
        );
        return NextResponse.json( { success: true, refundStatus: result.status, refundedAmount: result.confirmedAmount } );
    } catch ( error )
    {
        console.error( 'Admin Cashfree refund request failed:', error );
        return NextResponse.json(
            { error: 'Refund status is being reconciled with Cashfree. Refresh payment history before retrying.' },
            { status: 502 }
        );
    }
}
