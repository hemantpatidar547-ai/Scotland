import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { isAdminRequest } from '@/lib/admin-auth';
import { bustProductCache } from '@/lib/data';

const VALID_PAYMENT_STATUSES = [ 'pending', 'paid', 'failed', 'refunded' ];
const VALID_RETURN_STATUSES = [ 'approved', 'rejected', 'received', 'refunded' ];
const VALID_ORDER_STATUSES = [ 'pending_payment', 'paid', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded' ];

/* ── GET /api/admin/orders ─── */
export async function GET ( req: NextRequest )
{
    try
    {
        if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const { searchParams } = new URL( req.url );
        const status = searchParams.get( 'status' );
        if ( status && status !== 'all' && !VALID_ORDER_STATUSES.includes( status ) )
            return NextResponse.json( { error: 'Invalid order status filter.' }, { status: 400 } );
        const search = ( searchParams.get( 'search' ) || '' ).trim().replace( /[%_,().]/g, ' ' ).slice( 0, 100 );
        const requestedPage = Number.parseInt( searchParams.get( 'page' ) || '1', 10 );
        const requestedLimit = Number.parseInt( searchParams.get( 'limit' ) || '20', 10 );
        const page = Number.isSafeInteger( requestedPage ) && requestedPage > 0 ? Math.min( requestedPage, 100000 ) : 1;
        const limit = Number.isSafeInteger( requestedLimit ) && requestedLimit > 0 ? Math.min( requestedLimit, 100 ) : 20;
        const rawFromDate = searchParams.get( 'from_date' );
        const rawToDate = searchParams.get( 'to_date' );
        const fromDate = rawFromDate && Number.isFinite( Date.parse( rawFromDate ) ) ? new Date( rawFromDate ).toISOString() : null;
        const toDate = rawToDate && Number.isFinite( Date.parse( rawToDate ) ) ? new Date( rawToDate ).toISOString() : null;
        if ( rawFromDate && !fromDate || rawToDate && !toDate )
            return NextResponse.json( { error: 'Invalid order date range.' }, { status: 400 } );
        if ( fromDate && toDate && fromDate > toDate )
            return NextResponse.json( { error: 'The start date must be before the end date.' }, { status: 400 } );

        const db = getSupabaseAdmin();

        // Base query for paginated results
        let query = db.from( 'orders' )
            .select( '*', { count: 'exact' } )
            .is( 'admin_archived_at', null )
            .order( 'created_at', { ascending: false } );

        if ( status && status !== 'all' )
        {
            query = query.eq( 'order_status', status );
        }

        if ( search )
        {
            const orString = 'order_number.ilike.%' + search + '%,user_email.ilike.%' + search + '%,shipping_address->>name.ilike.%' + search + '%,shipping_address->>phone.ilike.%' + search + '%';
            query = query.or( orString );
        }

        if ( fromDate )
        {
            query = query.gte( 'created_at', fromDate );
        }
        if ( toDate )
        {
            query = query.lte( 'created_at', toDate );
        }

        const from = ( page - 1 ) * limit;
        query = query.range( from, from + limit - 1 );

        const { data: orders, count, error: ordersError } = await query;
        if ( ordersError ) throw ordersError;

        const mappedOrders = ( orders || [] ).map( o => ( {
            _id: o.id,
            orderNumber: o.order_number,
            userEmail: o.user_email || o.email,
            finalAmount: o.final_amount,
            orderStatus: o.order_status,
            courierDispatchQueued: Boolean( o.courier_dispatch_queued ),
            trackingNumber: o.tracking_number,
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
            subtotal: o.subtotal,
            shippingCost: o.shipping_cost,
            couponDiscount: o.coupon_discount,
            tax: o.tax,
            invoiceNumber: o.invoice_number,
            items: o.items,
            createdAt: o.created_at,
        } ) );

        const getFilteredCount = async ( orderStatus?: string, paymentStatus?: string, paymentMethod?: string ) =>
        {
            let countQuery = db.from( 'orders' ).select( 'id', { count: 'exact', head: true } );
            countQuery = countQuery.is( 'admin_archived_at', null );
            if ( search )
            {
                const orString = 'order_number.ilike.%' + search + '%,user_email.ilike.%' + search + '%,shipping_address->>name.ilike.%' + search + '%,shipping_address->>phone.ilike.%' + search + '%';
                countQuery = countQuery.or( orString );
            }
            if ( fromDate ) countQuery = countQuery.gte( 'created_at', fromDate );
            if ( toDate ) countQuery = countQuery.lte( 'created_at', toDate );
            if ( orderStatus ) countQuery = countQuery.eq( 'order_status', orderStatus );
            if ( paymentStatus ) countQuery = countQuery.eq( 'payment_status', paymentStatus );
            if ( paymentMethod ) countQuery = countQuery.eq( 'payment_method', paymentMethod );
            const { count, error } = await countQuery;
            if ( error ) throw error;
            return count || 0;
        };
        const [ totalOrders, pendingOrders, processingOrders, packedOrders, shippedOrders, deliveredOrders, cancelledOrders, refundedOrders, paidPayments, codPendingPayments ] = await Promise.all( [
            getFilteredCount(),
            getFilteredCount( 'pending_payment' ),
            getFilteredCount( 'processing' ),
            getFilteredCount( 'packed' ),
            getFilteredCount( 'shipped' ),
            getFilteredCount( 'delivered' ),
            getFilteredCount( 'cancelled' ),
            getFilteredCount( 'refunded' ),
            getFilteredCount( undefined, 'paid' ),
            getFilteredCount( undefined, 'pending', 'cod' ),
        ] );

        const summary = {
            totalOrders,
            pendingOrders,
            processingOrders,
            packedOrders,
            shippedOrders,
            deliveredOrders,
            cancelledOrders,
            refundedOrders,
            paidPayments,
            codPendingPayments,
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
        if (
            err && typeof err === 'object' &&
            'code' in err &&
            ( err.code === '42703' || err.code === 'PGRST204' || err.code === 'PGRST200' )
        )
        {
            return NextResponse.json( {
                error: 'Admin order archive is not installed yet. Apply supabase/migrations/0016_archive_existing_admin_orders.sql in the Supabase SQL Editor.',
            }, { status: 503 } );
        }
        return NextResponse.json( { error: 'Failed to fetch orders' }, { status: 500 } );
    }
}

/* ── PATCH /api/admin/orders ─── */
export async function PATCH ( req: NextRequest )
{
    try
    {
        if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const origin = req.headers.get( 'origin' );
        if ( origin && origin !== req.nextUrl.origin )
            return NextResponse.json( { error: 'Invalid request origin.' }, { status: 403 } );

        let body: unknown;
        try
        {
            body = await req.json();
        } catch
        {
            return NextResponse.json( { error: 'Request body must be valid JSON.' }, { status: 400 } );
        }
        if ( !body || typeof body !== 'object' || Array.isArray( body ) )
            return NextResponse.json( { error: 'A valid order update is required.' }, { status: 400 } );
        const { orderId, orderStatus, paymentStatus, returnStatus } = body as Record<string, unknown>;
        if ( typeof orderId !== 'string' || !orderId.trim() || orderId.length > 100 )
            return NextResponse.json( { error: 'A valid order ID is required.' }, { status: 400 } );
        if ( orderStatus !== undefined && typeof orderStatus !== 'string' )
            return NextResponse.json( { error: 'Invalid order status.' }, { status: 400 } );
        if ( paymentStatus !== undefined && typeof paymentStatus !== 'string' )
            return NextResponse.json( { error: 'Invalid payment status.' }, { status: 400 } );
        if ( returnStatus !== undefined && typeof returnStatus !== 'string' )
            return NextResponse.json( { error: 'Invalid return status.' }, { status: 400 } );
        if ( returnStatus && !VALID_RETURN_STATUSES.includes( returnStatus ) )
            return NextResponse.json( { error: 'Invalid return status' }, { status: 400 } );
        if ( returnStatus && ( orderStatus || paymentStatus ) )
            return NextResponse.json( { error: 'Update return status separately from order or payment status.' }, { status: 400 } );
        if ( orderStatus && orderStatus !== 'cancelled' )
            return NextResponse.json( { error: 'Delivery/order progress cannot be changed manually. It must come from the courier integration.' }, { status: 409 } );
        if ( paymentStatus && !VALID_PAYMENT_STATUSES.includes( paymentStatus ) )
            return NextResponse.json( { error: 'Invalid payment status' }, { status: 400 } );
        if ( !orderStatus && !paymentStatus && !returnStatus )
            return NextResponse.json( { error: 'Choose a supported order, payment, or return update.' }, { status: 400 } );
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
        if ( paymentStatus ) upd.payment_status = paymentStatus;

        const updateQuery = db.from( 'orders' ).update( upd ).eq( 'id', orderId );
        const { data, error } = await updateQuery.select( 'id' ).maybeSingle();
        if ( error ) throw error;
        if ( !data )
            return NextResponse.json( { error: 'Order not found.' }, { status: 404 } );

        return NextResponse.json( { success: true } );
    } catch ( err )
    {
        console.error( 'Admin orders PATCH error:', err );
        return NextResponse.json( { error: 'Failed to update order' }, { status: 500 } );
    }
}
