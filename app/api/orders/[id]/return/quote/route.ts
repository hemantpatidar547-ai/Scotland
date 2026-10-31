import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/ssr-server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { enforceRateLimit } from '@/lib/rate-limit';
import { DelhiveryServiceError, getDelhiveryReturnShippingCharge } from '@/lib/delhivery/serviceability';

const quoteSchema = z.object( {
    itemIndexes: z.array( z.number().int().min( 0 ).max( 99 ) ).min( 1 ).max( 100 )
        .refine( indexes => new Set( indexes ).size === indexes.length ),
} );

type ReturnItem = {
    totalPrice?: number | string;
    price?: number | string;
    quantity?: number | string;
};

function getItemAmount ( item: ReturnItem ): number
{
    const totalPrice = Number( item.totalPrice );
    if ( Number.isFinite( totalPrice ) && totalPrice > 0 ) return totalPrice;
    const price = Number( item.price );
    const quantity = Number( item.quantity || 1 );
    return Number.isFinite( price ) && Number.isFinite( quantity ) && price > 0 && quantity > 0
        ? price * quantity
        : 0;
}

export async function POST (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
)
{
    const auth = await createClient();
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if ( authError || !user )
        return NextResponse.json( { error: 'Please sign in to check the return courier charge.' }, { status: 401 } );

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
            .select( 'user_id, shipping_address, items, coupon_discount, final_amount, total_amount, shipping_cost, order_status, delivered_at, return_status' )
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

        const items = Array.isArray( order.items ) ? order.items as ReturnItem[] : [];
        if ( parsed.data.itemIndexes.some( index => index >= items.length ) )
            return NextResponse.json( { error: 'Select valid products to return.' }, { status: 400 } );

        const orderItemsAmount = items.reduce( ( sum, item ) => sum + getItemAmount( item ), 0 );
        const selectedItemsAmount = parsed.data.itemIndexes.reduce( ( sum, index ) => sum + getItemAmount( items[ index ] ), 0 );
        if ( orderItemsAmount <= 0 || selectedItemsAmount <= 0 )
            return NextResponse.json( { error: 'The selected product amounts could not be calculated.' }, { status: 400 } );

        const shippingAddress = order.shipping_address as { postalCode?: string } | null;
        const customerPincode = shippingAddress?.postalCode;
        if ( !customerPincode || !/^[0-9]{6}$/.test( customerPincode ) )
            return NextResponse.json( { error: 'The delivery PIN code on this order is invalid. Contact support for a return quote.' }, { status: 409 } );

        const returnShippingCharge = await getDelhiveryReturnShippingCharge( customerPincode );
        const discountShare = Math.round( Number( order.coupon_discount || 0 ) * selectedItemsAmount / orderItemsAmount * 100 ) / 100;
        const refundCap = Math.max( 0, Number( order.final_amount ?? order.total_amount ?? 0 ) - Number( order.shipping_cost || 0 ) );
        const refundAmount = Math.max( 0, Math.min( selectedItemsAmount - discountShare - returnShippingCharge, refundCap ) );

        return NextResponse.json( { returnShippingCharge, refundAmount } );
    } catch ( error )
    {
        if ( error instanceof DelhiveryServiceError )
            return NextResponse.json( { error: 'The return courier charge is temporarily unavailable. Please try again.' }, { status: 503 } );
        console.error( 'Return courier quote failed:', error );
        return NextResponse.json( { error: 'Could not check the return courier charge. Please try again.' }, { status: 500 } );
    }
}
