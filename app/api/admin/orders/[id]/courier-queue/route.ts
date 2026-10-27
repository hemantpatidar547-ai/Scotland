import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase/db';

const FINAL_ORDER_STATUSES = new Set( [ 'cancelled', 'refunded', 'delivered', 'returned', 'shipped', 'out_for_delivery' ] );

export async function POST ( req: NextRequest, { params }: { params: Promise<{ id: string }> } )
{
    try
    {
        if ( !await isAdminRequest() )
            return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const { id } = await params;
        const body: unknown = await req.json();
        if ( !body || typeof body !== 'object' || !('queued' in body) || typeof body.queued !== 'boolean' )
            return NextResponse.json( { error: 'A boolean queued value is required.' }, { status: 400 } );

        const queued = body.queued;
        const db = getSupabaseAdmin();
        const { data: order, error: readError } = await db.from( 'orders' )
            .select( 'id, order_status, payment_status, payment_method, tracking_number, courier_dispatch_queued' )
            .eq( 'id', id )
            .maybeSingle();

        if ( readError ) throw readError;
        if ( !order ) return NextResponse.json( { error: 'Order not found.' }, { status: 404 } );
        if ( order.courier_dispatch_queued === queued )
            return NextResponse.json( { success: true, queued } );
        if ( queued && FINAL_ORDER_STATUSES.has( String( order.order_status ).toLowerCase() ) )
            return NextResponse.json( { error: 'Cancelled, refunded, returned, delivered, or already dispatched orders cannot be queued for dispatch.' }, { status: 409 } );
        if (
            queued &&
            String( order.payment_status || '' ).toLowerCase() !== 'paid' &&
            String( order.payment_method || '' ).toLowerCase() !== 'cod'
        )
            return NextResponse.json( { error: 'Complete online payment before confirming this order for courier dispatch.' }, { status: 409 } );
        if ( queued && order.tracking_number )
            return NextResponse.json( { error: 'This order already has a tracking number and cannot be queued as a new shipment.' }, { status: 409 } );
        if ( !queued && order.tracking_number )
            return NextResponse.json( { error: 'An order with a tracking number cannot be removed from the courier queue.' }, { status: 409 } );

        let updateQuery = db.from( 'orders' )
            .update( { courier_dispatch_queued: queued, updated_at: new Date().toISOString() } )
            .eq( 'id', id )
            .eq( 'order_status', order.order_status )
            .eq( 'courier_dispatch_queued', order.courier_dispatch_queued );
        updateQuery = order.tracking_number === null
            ? updateQuery.is( 'tracking_number', null )
            : updateQuery.eq( 'tracking_number', order.tracking_number );
        const { data: updatedOrder, error: updateError } = await updateQuery.select( 'id' ).maybeSingle();

        if ( updateError ) throw updateError;
        if ( !updatedOrder )
            return NextResponse.json( { error: 'The order changed while you were updating it. Refresh and try again.' }, { status: 409 } );

        return NextResponse.json( { success: true, queued } );
    } catch ( error )
    {
        console.error( 'Admin courier queue update error:', error );
        if (
            error && typeof error === 'object' &&
            'code' in error &&
            ( error.code === '42703' || error.code === 'PGRST204' || error.code === 'PGRST200' )
        )
        {
            return NextResponse.json( {
                error: 'Courier queue is not installed yet. Apply supabase/migrations/0014_courier_dispatch_queue.sql in the Supabase SQL Editor.',
            }, { status: 503 } );
        }
        return NextResponse.json( { error: 'Could not update the courier queue.' }, { status: 500 } );
    }
}
