import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/ssr-server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { bustProductCache } from '@/lib/data';

export async function POST (
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
)
{
    const auth = await createClient();
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if ( authError || !user )
        return NextResponse.json( { error: 'Please sign in to cancel this order.' }, { status: 401 } );

    const { id } = await params;
    if ( !/^[0-9a-f-]{36}$/i.test( id ) )
        return NextResponse.json( { error: 'Invalid order ID.' }, { status: 400 } );

    try
    {
        const db = getSupabaseAdmin();
        const { data, error } = await db.rpc( 'cancel_customer_order', {
            p_order_id: id,
            p_user_id: user.id,
        } );
        if ( error )
        {
            const message = error.message.toLowerCase();
            if ( message.includes( 'order not found' ) )
                return NextResponse.json( { error: 'Order not found.' }, { status: 404 } );
            if ( message.includes( 'can no longer be cancelled' ) )
                return NextResponse.json( { error: 'This order has already been dispatched or completed and can no longer be cancelled.' }, { status: 409 } );
            if ( error.code === 'PGRST202' )
                return NextResponse.json( { error: 'Order cancellation setup is incomplete. Apply supabase/migrations/0011_order_cancellation.sql in the Supabase SQL Editor.' }, { status: 503 } );
            throw error;
        }

        bustProductCache();
        const cancelledOrder = Array.isArray( data ) ? data[ 0 ] : data;
        return NextResponse.json( {
            success: true,
            orderNumber: cancelledOrder?.order_number,
            paymentStatus: cancelledOrder?.payment_status,
        } );
    } catch ( error )
    {
        console.error( 'Customer order cancellation failed:', error );
        return NextResponse.json( { error: 'Could not cancel this order. Please try again or contact support.' }, { status: 500 } );
    }
}
