import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/ssr-server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const VALID_STATUSES = [ 'pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded' ];

async function requireAdmin ()
{
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if ( error || !user || user.email !== process.env.ADMIN_EMAIL )
        return null;
    return user;
}

/* ── GET /api/admin/orders ─── */
export async function GET ( req: NextRequest )
{
    try
    {
        if ( !await requireAdmin() )
            return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const { searchParams } = new URL( req.url );
        const status = searchParams.get( 'status' );
        const search = searchParams.get( 'search' );
        const page = parseInt( searchParams.get( 'page' ) || '1' );
        const limit = parseInt( searchParams.get( 'limit' ) || '20' );

        const db = await getDb();
        const query: any = {};

        if ( status && status !== 'all' ) query.orderStatus = status;
        if ( search ) query.$or = [
            { orderNumber: { $regex: search, $options: 'i' } },
            { 'shippingAddress.name': { $regex: search, $options: 'i' } },
            { userEmail: { $regex: search, $options: 'i' } },
        ];

        const total = await db.collection( 'orders' ).countDocuments( query );
        const orders = await db.collection( 'orders' )
            .find( query )
            .sort( { createdAt: -1 } )
            .skip( ( page - 1 ) * limit )
            .limit( limit )
            .toArray();

        return NextResponse.json( {
            data: orders.map( o => ( { ...o, _id: o._id.toString() } ) ),
            total,
            page,
            totalPages: Math.ceil( total / limit ),
        } );
    }
    catch ( err )
    {
        console.error( 'Admin orders GET error:', err );
        return NextResponse.json( { error: 'Failed to fetch orders' }, { status: 500 } );
    }
}

/* ── PATCH /api/admin/orders  (update order status) ─── */
export async function PATCH ( req: NextRequest )
{
    try
    {
        if ( !await requireAdmin() )
            return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const { orderId, orderStatus, paymentStatus } = await req.json();

        if ( !orderId ) return NextResponse.json( { error: 'Order ID required' }, { status: 400 } );
        if ( orderStatus && !VALID_STATUSES.includes( orderStatus ) )
            return NextResponse.json( { error: 'Invalid order status' }, { status: 400 } );

        const db = await getDb();
        const upd: any = { updatedAt: new Date() };
        if ( orderStatus ) upd.orderStatus = orderStatus;
        if ( paymentStatus ) upd.paymentStatus = paymentStatus;

        const result = await db.collection( 'orders' ).updateOne(
            { _id: new ObjectId( orderId ) },
            { $set: upd }
        );

        if ( result.matchedCount === 0 )
            return NextResponse.json( { error: 'Order not found' }, { status: 404 } );

        /* Restore stock when cancelled */
        if ( orderStatus === 'cancelled' )
        {
            const order = await db.collection( 'orders' ).findOne( { _id: new ObjectId( orderId ) } );
            if ( order?.items )
            {
                for ( const item of order.items )
                {
                    try
                    {
                        await db.collection( 'products' ).updateOne(
                            { _id: new ObjectId( item.productId ) },
                            { $inc: { stock: item.quantity } }
                        );
                    } catch { /* ignore */ }
                }
            }
        }

        return NextResponse.json( { success: true } );
    }
    catch ( err )
    {
        console.error( 'Admin orders PATCH error:', err );
        return NextResponse.json( { error: 'Failed to update order' }, { status: 500 } );
    }
}
