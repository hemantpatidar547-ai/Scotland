import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { isAdminRequest } from '@/lib/admin-auth';

const VALID_STATUSES = [ 'pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded' ];

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

        const { orderId, orderStatus, paymentStatus } = await req.json();
        if ( !orderId ) return NextResponse.json( { error: 'Order ID required' }, { status: 400 } );
        if ( orderStatus && !VALID_STATUSES.includes( orderStatus ) )
            return NextResponse.json( { error: 'Invalid order status' }, { status: 400 } );

        const db = getSupabaseAdmin();
        const upd: any = { updated_at: new Date().toISOString() };
        if ( orderStatus ) upd.order_status = orderStatus;
        if ( paymentStatus ) upd.payment_status = paymentStatus;

        const { error } = await db.from( 'orders' ).update( upd ).eq( 'id', orderId );
        if ( error ) throw error;

        return NextResponse.json( { success: true } );
    } catch ( err )
    {
        console.error( 'Admin orders PATCH error:', err );
        return NextResponse.json( { error: 'Failed to update order' }, { status: 500 } );
    }
}
