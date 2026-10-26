import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { isAdminRequest } from '@/lib/admin-auth';
import { bustProductCache } from '@/lib/data';

const VALID_STATUSES = [ 'pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded' ];
const VALID_PAYMENT_STATUSES = [ 'pending', 'paid', 'failed', 'refunded' ];
const VALID_RETURN_STATUSES = [ 'approved', 'rejected', 'received', 'refunded' ];

/* ── GET /api/admin/orders ─── */
export async function GET ( req: NextRequest )
{
    try
    {
        if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const { searchParams } = new URL( req.url );
        const status = searchParams.get( 'status' );
        const search = searchParams.get( 'search' );
        const page = parseInt( searchParams.get( 'page' ) || '1' );
        const limit = parseInt( searchParams.get( 'limit' ) || '20' );
        const fromDate = searchParams.get( 'from_date' );
        const toDate = searchParams.get( 'to_date' );

        const db = getSupabaseAdmin();

        // Base query for stats (unpaginated, only fetching required fields for stats)
        let statsQuery = db.from( 'orders' ).select( 'final_amount, order_status' );

        // Base query for paginated results
        let query = db.from( 'orders' ).select( '*', { count: 'exact' } ).order( 'created_at', { ascending: false } );

        if ( status && status !== 'all' )
        {
            statsQuery = statsQuery.eq( 'order_status', status );
            query = query.eq( 'order_status', status );
        }

        if ( search )
        {
            const orString = 'order_number.ilike.%' + search + '%,user_email.ilike.%' + search + '%,shipping_address->>name.ilike.%' + search + '%,shipping_address->>phone.ilike.%' + search + '%';
            statsQuery = statsQuery.or( orString );
            query = query.or( orString );
        }

        if ( fromDate )
        {
            statsQuery = statsQuery.gte( 'created_at', fromDate );
            query = query.gte( 'created_at', fromDate );
        }
        if ( toDate )
        {
            statsQuery = statsQuery.lte( 'created_at', toDate );
            query = query.lte( 'created_at', toDate );
        }

        const from = ( page - 1 ) * limit;
        query = query.range( from, from + limit - 1 );

        const { data: orders, count } = await query;

        const mappedOrders = ( orders || [] ).map( o => ( {
            _id: o.id,
            orderNumber: o.order_number,
            userEmail: o.user_email || o.email,
            finalAmount: o.final_amount,
            orderStatus: o.order_status,
            paymentMethod: o.payment_method,
            paymentStatus: o.payment_status,
            returnStatus: o.return_status,
            returnReason: o.return_reason,
            returnItems: Array.isArray( o.return_item_indexes )
                ? o.return_item_indexes.map( ( index: number ) => o.items?.[ index ]?.name || 'Product' )
                : [],
            returnRefundAmount: o.return_refund_amount,
            returnRequestedAt: o.return_requested_at,
            shippingAddress: o.shipping_address,
            items: o.items,
            createdAt: o.created_at,
        } ) );

        const { data: statsData } = await statsQuery;

        const summary = {
            totalOrders: statsData?.length || 0,
            totalSales: statsData?.reduce( ( sum, o ) => sum + ( o.final_amount || 0 ), 0 ) || 0,
            newOrders: statsData?.filter( o => o.order_status === 'new' ).length || 0,
            pendingOrders: statsData?.filter( o => o.order_status === 'pending' ).length || 0,
            processingOrders: statsData?.filter( o => o.order_status === 'processing' ).length || 0,
            shippedOrders: statsData?.filter( o => o.order_status === 'shipped' ).length || 0,
            deliveredOrders: statsData?.filter( o => o.order_status === 'delivered' ).length || 0,
            cancelledOrders: statsData?.filter( o => o.order_status === 'cancelled' ).length || 0,
            refundedOrders: statsData?.filter( o => o.order_status === 'refunded' ).length || 0,
        };

        return NextResponse.json( {
            data: mappedOrders,
            summary,
            total: count || 0,
            page,
            totalPages: Math.ceil( ( count || 0 ) / limit ),
        } );
    } catch ( err )
    {
        console.error( 'Admin orders GET error:', err );
        return NextResponse.json( { error: 'Failed to fetch orders' }, { status: 500 } );
    }
}

/* ── PATCH /api/admin/orders ─── */
export async function PATCH ( req: NextRequest )
{
    try
    {
        if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const { orderId, orderStatus, paymentStatus, returnStatus } = await req.json();
        if ( !orderId ) return NextResponse.json( { error: 'Order ID required' }, { status: 400 } );
        if ( returnStatus && !VALID_RETURN_STATUSES.includes( returnStatus ) )
            return NextResponse.json( { error: 'Invalid return status' }, { status: 400 } );
        if ( returnStatus && ( orderStatus || paymentStatus ) )
            return NextResponse.json( { error: 'Update return status separately from order or payment status.' }, { status: 400 } );
        if ( orderStatus && !VALID_STATUSES.includes( orderStatus ) )
            return NextResponse.json( { error: 'Invalid order status' }, { status: 400 } );
        if ( paymentStatus && !VALID_PAYMENT_STATUSES.includes( paymentStatus ) )
            return NextResponse.json( { error: 'Invalid payment status' }, { status: 400 } );
        if ( orderStatus === 'cancelled' && paymentStatus )
            return NextResponse.json( { error: 'Cancel the order first, then update its payment status after manually processing any refund.' }, { status: 400 } );

        const db = getSupabaseAdmin();
        if ( returnStatus )
        {
            const { data: order, error: readError } = await db.from( 'orders' )
                .select( 'return_status, return_item_indexes, items' )
                .eq( 'id', orderId )
                .maybeSingle();
            if ( readError ) throw readError;
            if ( !order ) return NextResponse.json( { error: 'Order not found.' }, { status: 404 } );

            const allowedTransitions: Record<string, string[]> = {
                requested: [ 'approved', 'rejected' ],
                approved: [ 'received' ],
                received: [ 'refunded' ],
            };
            if ( !order.return_status || !allowedTransitions[ order.return_status ]?.includes( returnStatus ) )
                return NextResponse.json( { error: 'That return status change is not allowed. Follow requested → approved/rejected → received → refunded.' }, { status: 409 } );

            const returnUpdate: Record<string, string> = {
                return_status: returnStatus,
                updated_at: new Date().toISOString(),
            };
            const isFullOrderReturn = Array.isArray( order.return_item_indexes ) &&
                Array.isArray( order.items ) &&
                order.return_item_indexes.length === order.items.length;
            if ( returnStatus === 'refunded' && isFullOrderReturn ) returnUpdate.payment_status = 'refunded';
            const { data, error } = await db.from( 'orders' )
                .update( returnUpdate )
                .eq( 'id', orderId )
                .eq( 'return_status', order.return_status )
                .select( 'id' )
                .maybeSingle();
            if ( error ) throw error;
            if ( !data ) return NextResponse.json( { error: 'Return status changed elsewhere. Refresh and try again.' }, { status: 409 } );
            return NextResponse.json( { success: true } );
        }

        if ( orderStatus === 'cancelled' )
        {
            const { error } = await db.rpc( 'cancel_customer_order', {
                p_order_id: orderId,
                p_user_id: null,
            } );
            if ( error )
            {
                const message = error.message.toLowerCase();
                if ( message.includes( 'order not found' ) )
                    return NextResponse.json( { error: 'Order not found.' }, { status: 404 } );
                if ( message.includes( 'can no longer be cancelled' ) )
                    return NextResponse.json( { error: 'This order has already been dispatched or completed and cannot be cancelled.' }, { status: 409 } );
                if ( error.code === 'PGRST202' )
                    return NextResponse.json( { error: 'Cancellation setup is incomplete. Apply supabase/migrations/0011_order_cancellation.sql in the Supabase SQL Editor.' }, { status: 503 } );
                throw error;
            }
            bustProductCache();
            return NextResponse.json( { success: true } );
        }

        if ( paymentStatus === 'refunded' )
        {
            const { data: order, error: readError } = await db.from( 'orders' )
                .select( 'order_status, return_status' )
                .eq( 'id', orderId )
                .maybeSingle();
            if ( readError ) throw readError;
            if ( !order ) return NextResponse.json( { error: 'Order not found.' }, { status: 404 } );
            if ( order.return_status !== 'received' && order.order_status !== 'cancelled' )
                return NextResponse.json( { error: 'Only mark a return refund after the returned product is received, or a cancelled prepaid order has been refunded.' }, { status: 409 } );
        }

        const upd: Record<string, string> = { updated_at: new Date().toISOString() };
        if ( orderStatus ) upd.order_status = orderStatus;
        if ( paymentStatus ) upd.payment_status = paymentStatus;

        let updateQuery = db.from( 'orders' ).update( upd ).eq( 'id', orderId );
        if ( orderStatus ) updateQuery = updateQuery.neq( 'order_status', 'cancelled' );
        const { data, error } = await updateQuery.select( 'id' ).maybeSingle();
        if ( error ) throw error;
        if ( !data )
            return NextResponse.json( { error: 'Cancelled orders cannot be reopened or moved to another order status.' }, { status: 409 } );

        return NextResponse.json( { success: true } );
    } catch ( err )
    {
        console.error( 'Admin orders PATCH error:', err );
        return NextResponse.json( { error: 'Failed to update order' }, { status: 500 } );
    }
}
