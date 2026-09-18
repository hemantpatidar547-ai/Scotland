import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/ssr-server';
import { getDb } from '@/lib/mongodb';

async function requireAdmin ()
{
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if ( error || !user || user.email !== process.env.ADMIN_EMAIL )
        return null;
    return user;
}

/* ── GET /api/admin/stats ─── */
export async function GET ()
{
    try
    {
        const adminUser = await requireAdmin();
        if ( !adminUser ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const db = await getDb();

        const [ totalOrders, orders, products, customers ] = await Promise.all( [
            db.collection( 'orders' ).countDocuments(),
            db.collection( 'orders' ).find( {} ).toArray(),
            db.collection( 'products' ).find( {} ).toArray(),
            db.collection( 'customers' ).find( {} ).toArray(),
        ] );

        const totalSales = orders.filter( o => o.paymentStatus === 'paid' || o.paymentMethod === 'cod' ).reduce( ( sum: number, o: any ) => sum + ( o.finalAmount || 0 ), 0 );
        const pendingOrders = orders.filter( ( o: any ) => o.orderStatus === 'pending' ).length;
        const processingOrders = orders.filter( ( o: any ) => o.orderStatus === 'processing' ).length;
        const deliveredOrders = orders.filter( ( o: any ) => o.orderStatus === 'delivered' ).length;
        const cancelledOrders = orders.filter( ( o: any ) => o.orderStatus === 'cancelled' ).length;
        const lowStockProducts = products.filter( ( p: any ) => ( p.stock ?? 0 ) < 5 && ( p.stock ?? 0 ) >= 0 );

        const recentOrders = orders
            .sort( ( a: any, b: any ) => new Date( b.createdAt ).getTime() - new Date( a.createdAt ).getTime() )
            .slice( 0, 5 )
            .map( ( o: any ) => ( { ...o, _id: o._id.toString() } ) );

        return NextResponse.json( {
            totalSales,
            totalOrders,
            totalProducts: products.length,
            totalCustomers: customers.length,
            pendingOrders,
            processingOrders,
            deliveredOrders,
            cancelledOrders,
            lowStockCount: lowStockProducts.length,
            recentOrders,
            lowStockProducts: lowStockProducts.slice( 0, 5 ).map( p => ( { ...p, _id: p._id.toString() } ) ),
        } );
    }
    catch ( err )
    {
        console.error( 'Admin stats error:', err );
        return NextResponse.json( { error: 'Failed to load stats' }, { status: 500 } );
    }
}
