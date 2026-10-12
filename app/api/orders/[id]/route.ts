import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/ssr-server';
import { getSupabaseAdmin } from '@/lib/supabase/db';

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

        const db = getSupabaseAdmin();
        const { data: order } = await db
            .from( 'orders' )
            .select( '*' )
            .or( `id.eq.${ id },order_number.eq.${ id }` )
            .single();

        if ( !order ) return NextResponse.json( { error: 'Order not found' }, { status: 404 } );

        const adminEmails = [ 'patidarhemant226@gmail.com', 'hemantpatidar547@gmail.com', process.env.ADMIN_EMAIL ];
        const isAdmin = adminEmails.includes( user.email );
        if ( !isAdmin && order.user_id !== user.id )
            return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        return NextResponse.json( { data: order } );
    } catch ( err )
    {
        console.error( 'Order detail error:', err );
        return NextResponse.json( { error: 'Failed to fetch order' }, { status: 500 } );
    }
}
