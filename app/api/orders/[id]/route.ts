import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/ssr-server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { isAdminEmail } from '@/lib/admin-authorization';

export async function GET (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
)
{
    try
    {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if ( authError || !user ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const db = getSupabaseAdmin();
        let query = db.from( 'orders' )
            .select( 'id, order_number, user_id, user_email, email, shipping_address, items, subtotal, shipping_cost, tax, coupon_code, coupon_discount, final_amount, total_amount, payment_method, payment_status, order_status, tracking_number, courier_name, courier_status, courier_status_updated_at, created_at, updated_at' );
        if ( !isAdminEmail( user.email ) ) query = query.eq( 'user_id', user.id );

        const { data: order, error } = /^[0-9a-f-]{36}$/i.test( id )
            ? await query.eq( 'id', id ).maybeSingle()
            : await query.eq( 'order_number', id ).maybeSingle();

        if ( error ) throw error;
        if ( !order ) return NextResponse.json( { error: 'Order not found' }, { status: 404 } );
        return NextResponse.json( { data: order } );
    } catch ( error )
    {
        console.error( 'Order detail fetch failed:', error );
        return NextResponse.json( { error: 'Failed to fetch order' }, { status: 500 } );
    }
}
