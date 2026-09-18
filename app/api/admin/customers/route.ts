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

/* ── GET /api/admin/customers ─── */
export async function GET ( req: NextRequest )
{
    try
    {
        if ( !await requireAdmin() )
            return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const db = await getDb();
        const orders = await db.collection( 'orders' ).find( {} ).toArray();

        /* Aggregate customer data from orders */
        const customerMap = new Map<string, any>();

        for ( const order of orders )
        {
            const uid = order.userId;
            if ( !uid ) continue;

            if ( !customerMap.has( uid ) )
            {
                customerMap.set( uid, {
                    userId: uid,
                    email: order.userEmail || 'Unknown',
                    name: order.shippingAddress?.name || 'Unknown',
                    phone: order.shippingAddress?.phone || '',
                    orderCount: 0,
                    totalSpent: 0,
                    lastOrderAt: null,
                    firstOrderAt: null,
                } );
            }

            const c = customerMap.get( uid );
            c.orderCount++;
            c.totalSpent += order.finalAmount || 0;
            const oDate = new Date( order.createdAt );
            if ( !c.lastOrderAt || oDate > new Date( c.lastOrderAt ) ) c.lastOrderAt = order.createdAt;
            if ( !c.firstOrderAt || oDate < new Date( c.firstOrderAt ) ) c.firstOrderAt = order.createdAt;
        }

        const customers = Array.from( customerMap.values() )
            .sort( ( a, b ) => b.totalSpent - a.totalSpent );

        return NextResponse.json( { data: customers } );
    }
    catch ( err )
    {
        console.error( 'Admin customers error:', err );
        return NextResponse.json( { error: 'Failed to fetch customers' }, { status: 500 } );
    }
}
