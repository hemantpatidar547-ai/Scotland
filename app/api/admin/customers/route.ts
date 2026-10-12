import { NextRequest, NextResponse } from 'next/server';
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

/* ── GET /api/admin/customers ─── */
export async function GET ( req: NextRequest )
{
    try
    {
        if ( !await requireAdmin() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const db = getSupabaseAdmin();
        const { data: orders } = await db.from( 'orders' ).select( '*' );

        /* Aggregate customer data from orders */
        const customerMap = new Map<string, any>();

        for ( const order of ( orders || [] ) )
        {
            const uid = order.user_id || order.user_email;
            if ( !uid ) continue;

            if ( !customerMap.has( uid ) )
            {
                customerMap.set( uid, {
                    userId: order.user_id,
                    email: order.user_email || 'Unknown',
                    name: order.shipping_address?.name || 'Unknown',
                    phone: order.shipping_address?.phone || '',
                    orderCount: 0,
                    totalSpent: 0,
                    lastOrderAt: null,
                    firstOrderAt: null,
                } );
            }

            const c = customerMap.get( uid );
            c.orderCount++;
            c.totalSpent += order.final_amount || 0;
            const oDate = new Date( order.created_at );
            if ( !c.lastOrderAt || oDate > new Date( c.lastOrderAt ) ) c.lastOrderAt = order.created_at;
            if ( !c.firstOrderAt || oDate < new Date( c.firstOrderAt ) ) c.firstOrderAt = order.created_at;
        }

        const customers = Array.from( customerMap.values() )
            .sort( ( a, b ) => b.totalSpent - a.totalSpent );

        return NextResponse.json( { data: customers } );
    } catch ( err )
    {
        console.error( 'Admin customers error:', err );
        return NextResponse.json( { error: 'Failed to fetch customers' }, { status: 500 } );
    }
}
