import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/ssr-server';
import { getSupabaseAdmin } from '@/lib/supabase/db';

async function requireAdmin ()
{
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    const adminEmails = [ 'patidarhemant226@gmail.com', 'hemantpatidar547@gmail.com', process.env.ADMIN_EMAIL ];
    if ( error || !user || !adminEmails.includes( user.email ) ) return null;
    return user;
}

/* ── GET /api/admin/stats ─── */
export async function GET ()
{
    try
    {
        const adminUser = await requireAdmin();
        if ( !adminUser ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const db = getSupabaseAdmin();

        const [ { data: orders }, { data: products }, { count: totalCustomers } ] = await Promise.all( [
            db.from( 'orders' ).select( '*' ),
            db.from( 'products' ).select( '*' ),
            db.from( 'orders' ).select( 'user_id', { count: 'exact', head: true } ),
        ] );

        const allOrders = orders || [];
        const allProducts = products || [];

        const totalSales = allOrders
            .filter( o => o.payment_status === 'paid' || o.payment_method === 'cod' )
            .reduce( ( sum, o ) => sum + ( o.final_amount || 0 ), 0 );

        const totalOrders = allOrders.length;
        const pendingOrders = allOrders.filter( o => o.order_status === 'pending' ).length;
        const processingOrders = allOrders.filter( o => o.order_status === 'processing' ).length;
        const deliveredOrders = allOrders.filter( o => o.order_status === 'delivered' ).length;
        const cancelledOrders = allOrders.filter( o => o.order_status === 'cancelled' ).length;
        const lowStockProducts = allProducts.filter( p => ( p.stock ?? 0 ) < 5 && ( p.stock ?? 0 ) >= 0 );

        const recentOrders = [ ...allOrders ]
            .sort( ( a, b ) => new Date( b.created_at ).getTime() - new Date( a.created_at ).getTime() )
            .slice( 0, 5 );

        return NextResponse.json( {
            totalSales,
            totalOrders,
            totalProducts: allProducts.length,
            totalCustomers: totalCustomers || 0,
            pendingOrders,
            processingOrders,
            deliveredOrders,
            cancelledOrders,
            lowStockCount: lowStockProducts.length,
            recentOrders,
            lowStockProducts: lowStockProducts.slice( 0, 5 ),
        } );
    } catch ( err )
    {
        console.error( 'Admin stats error:', err );
        return NextResponse.json( { error: 'Failed to load stats' }, { status: 500 } );
    }
}
