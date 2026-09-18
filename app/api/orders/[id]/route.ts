import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/ssr-server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
)
{
    try
    {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if ( error || !user ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const db = await getDb();
        let order;
        try
        {
            order = await db.collection( 'orders' ).findOne( { _id: new ObjectId( id ) } );
        }
        catch
        {
            order = await db.collection( 'orders' ).findOne( { orderNumber: id } );
        }

        if ( !order ) return NextResponse.json( { error: 'Order not found' }, { status: 404 } );

        /* Only admin or the order owner can view */
        const isAdmin = user.email === process.env.ADMIN_EMAIL;
        if ( !isAdmin && order.userId !== user.id )
            return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        return NextResponse.json( { data: { ...order, _id: order._id.toString() } } );
    }
    catch ( err )
    {
        console.error( 'Order detail error:', err );
        return NextResponse.json( { error: 'Failed to fetch order' }, { status: 500 } );
    }
}
