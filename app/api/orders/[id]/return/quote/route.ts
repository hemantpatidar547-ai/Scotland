import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/ssr-server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getReturnItemAmount, type ReturnableItem, RETURN_COURIER_CHARGE } from '@/lib/returns';

const quoteSchema = z.object( {
    itemIndexes: z.array( z.number().int().min( 0 ).max( 99 ) ).min( 1 ).max( 100 )
        .refine( indexes => new Set( indexes ).size === indexes.length ),
} );

export async function POST (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
)
{
    const auth = await createClient();
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if ( authError || !user )
        return NextResponse.json( { error: 'Please sign in to calculate your estimated return refund.' }, { status: 401 } );

    const rateLimitResponse = await enforceRateLimit( request, {
        scope: 'order-return-quote',
        limit: 10,
        windowSeconds: 900,
        subject: user.id,
    } );
    if ( rateLimitResponse ) return rateLimitResponse;

    const { id } = await params;
    if ( !/^[0-9a-f-]{36}$/i.test( id ) )
        return NextResponse.json( { error: 'Invalid order ID.' }, { status: 400 } );

    let body: unknown;
    try
    {
        body = await request.json();
    } catch
    {
        return NextResponse.json( { error: 'Select the products you want to return.' }, { status: 400 } );
    }

    const parsed = quoteSchema.safeParse( body );
    if ( !parsed.success )
        return NextResponse.json( { error: 'Select valid products to return.' }, { status: 400 } );

    try
    {
        const db = getSupabaseAdmin();
        const { data: order, error } = await db.from( 'orders' )
            .select( 'user_id, items, coupon_discount, final_amount, total_amount, shipping_cost, order_status, delivered_at, return_status' )
            .eq( 'id', id )
            .eq( 'user_id', user.id )
            .maybeSingle();
        if ( error ) throw error;
        if ( !order ) return NextResponse.json( { error: 'Order not found.' }, { status: 404 } );
        if ( order.order_status !== 'delivered' || !order.delivered_at )
            return NextResponse.json( { error: 'A return can only be requested after the order is marked delivered.' }, { status: 409 } );
        if ( Date.now() > new Date( order.delivered_at ).getTime() + 48 * 60 * 60 * 1000 )
            return NextResponse.json( { error: 'The 48-hour return window has expired.' }, { status: 409 } );
        if ( order.return_status )
            return NextResponse.json( { error: 'A return request already exists for this order.' }, { status: 409 } );

        const items = Array.isArray( order.items ) ? order.items as ReturnableItem[] : [];
        if ( parsed.data.itemIndexes.some( index => index >= items.length ) )
            return NextResponse.json( { error: 'Select valid products to return.' }, { status: 400 } );

        const orderItemsAmount = items.reduce( ( sum, item ) => sum + getReturnItemAmount( item ), 0 );
        const selectedItemsAmount = parsed.data.itemIndexes.reduce( ( sum, index ) => sum + getReturnItemAmount( items[ index ] ), 0 );
        if ( orderItemsAmount <= 0 || selectedItemsAmount <= 0 )
            return NextResponse.json( { error: 'The selected product amounts could not be calculated.' }, { status: 400 } );

        const discountShare = Math.round( Number( order.coupon_discount || 0 ) * selectedItemsAmount / orderItemsAmount * 100 ) / 100;
        const refundCap = Math.max( 0, Number( order.final_amount ?? order.total_amount ?? 0 ) - Number( order.shipping_cost || 0 ) );
        const refundAmount = Math.max( 0, Math.min( selectedItemsAmount - discountShare - RETURN_COURIER_CHARGE, refundCap ) );

        return NextResponse.json( { returnShippingCharge: RETURN_COURIER_CHARGE, refundAmount } );
    } catch ( error )
    {
        console.error( 'Return courier quote failed:', error );
        return NextResponse.json( { error: 'Could not calculate the estimated refund. Please try again.' }, { status: 500 } );
    }
}
