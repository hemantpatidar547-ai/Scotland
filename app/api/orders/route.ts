import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/ssr-server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { bustProductCache } from '@/lib/data';

/* ── POST /api/orders  (create order) ─────────── */
export async function POST ( req: NextRequest )
{
    try
    {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const body = await req.json();
        const {
            cartItems,
            shippingAddress,
            paymentMethod,
            razorpayPaymentId,
            razorpayOrderId,
            razorpaySignature,
            couponCode,
            couponDiscount = 0,
        } = body;

        if ( !cartItems?.length ) return NextResponse.json( { error: 'Cart is empty' }, { status: 400 } );
        if ( !shippingAddress ) return NextResponse.json( { error: 'Shipping address required' }, { status: 400 } );

        const db = getSupabaseAdmin();
        const normalizedCart = cartItems.map( ( item: any ) =>
        {
            const productId = item.product?.id || item.productId;
            const quantity = Number( item.quantity );
            if ( typeof productId !== 'string' || !Number.isInteger( quantity ) || quantity < 1 || !item.size || !item.color )
            {
                throw new Error( 'Each cart item must have a product, size, color, and valid quantity.' );
            }
            return { item, productId, quantity, size: String( item.size ), color: String( item.color ) };
        } );

        const productIds = Array.from( new Set( normalizedCart.map( ( item: any ) => item.productId ) ) );
        const { data: variants, error: variantsError } = await db
            .from( 'product_variants' )
            .select( 'id, product_id, size, color' )
            .in( 'product_id', productIds );

        if ( variantsError ) throw variantsError;

        const inventoryByVariant = new Map<string, number>();
        const validatedItems = normalizedCart.map( ( cartItem: any ) =>
        {
            const variant = variants?.find( candidate =>
                candidate.product_id === cartItem.productId &&
                ( candidate.size || 'One size' ) === cartItem.size &&
                ( candidate.color || 'Default' ) === cartItem.color
            );
            if ( !variant ) throw new Error( `The selected size/color for ${ cartItem.item.product?.name || 'a product' } is no longer available.` );

            inventoryByVariant.set( variant.id, ( inventoryByVariant.get( variant.id ) || 0 ) + cartItem.quantity );
            const price = Number( cartItem.item.product?.price || cartItem.item.price || 0 );
            return {
                productId: cartItem.productId,
                name: cartItem.item.product?.name || cartItem.item.name,
                image: cartItem.item.product?.image || cartItem.item.image,
                size: cartItem.size,
                color: cartItem.color,
                quantity: cartItem.quantity,
                price,
                totalPrice: price * cartItem.quantity,
            };
        } );

        const inventoryReservation = Array.from( inventoryByVariant, ( [ variant_id, quantity ] ) => ( { variant_id, quantity } ) );
        const { error: reservationError } = await db.rpc( 'decrement_product_variant_stocks', { p_items: inventoryReservation } );
        if ( reservationError )
        {
            console.error( 'Order inventory reservation failed:', reservationError );
            const isOutOfStock = reservationError.message.toLowerCase().includes( 'insufficient stock' );
            const inventoryRpcMissing = reservationError.code === 'PGRST202' &&
                reservationError.message.includes( 'decrement_product_variant_stocks' );
            return NextResponse.json(
                {
                    error: isOutOfStock
                        ? 'The requested quantity is no longer in stock. Please update your cart.'
                        : inventoryRpcMissing
                            ? 'Checkout inventory setup is incomplete. Run supabase/migrations/0003_atomic_variant_inventory.sql in the Supabase SQL Editor, then try again.'
                            : 'Could not reserve product stock. Please try again.',
                },
                { status: isOutOfStock ? 409 : inventoryRpcMissing ? 503 : 500 }
            );
        }

        /* Calculate amounts */
        let subtotal = 0;
        for ( const item of validatedItems ) subtotal += item.price * item.quantity;

        const shippingCost = subtotal >= 4000 ? 0 : 50; // flat Rs 50
        const tax = 0; // No tax for now
        const finalAmount = subtotal + shippingCost - couponDiscount;

        const orderNumber = `SC-${ Date.now() }`;

        const { data: order, error } = await db.from( 'orders' ).insert( {
            order_number: orderNumber,
            user_id: user?.id || null,
            user_email: user?.email || shippingAddress.email || null,
            email: user?.email || shippingAddress.email || '', // Fix for existing schema
            shipping_address: shippingAddress,
            items: validatedItems,
            subtotal,
            shipping_cost: shippingCost,
            tax,
            coupon_code: couponCode || null,
            coupon_discount: couponDiscount,
            final_amount: finalAmount,
            total_amount: finalAmount, // Fix for existing schema
            payment_method: paymentMethod,
            payment_status: paymentMethod === 'cod' ? 'pending' : 'paid',
            razorpay_payment_id: razorpayPaymentId || null,
            razorpay_order_id: razorpayOrderId || null,
            razorpay_signature: razorpaySignature || null,
            order_status: 'pending',
        } ).select().single();

        if ( error )
        {
            const { error: restoreError } = await db.rpc( 'restore_product_variant_stocks', { p_items: inventoryReservation } );
            if ( restoreError )
            {
                console.error( 'Failed to restore stock after order creation failed:', restoreError );
                throw new Error( `${ error.message }; stock restoration also failed.` );
            }
            throw error;
        }

        bustProductCache();

        return NextResponse.json( {
            success: true,
            orderId: order.id,
            orderNumber,
            finalAmount,
        } );
    } catch ( err: any )
    {
        console.error( 'Order creation error:', err );
        return NextResponse.json( { error: err?.message || 'Failed to create order' }, { status: 500 } );
    }
}

/* ── GET /api/orders  (list orders for logged-in user) ─── */
export async function GET ()
{
    try
    {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if ( error || !user ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const db = getSupabaseAdmin();
        const { data: orders, error: ordErr } = await db
            .from( 'orders' )
            .select( '*' )
            .eq( 'user_id', user.id )
            .order( 'created_at', { ascending: false } );

        if ( ordErr ) throw ordErr;

        return NextResponse.json( { data: orders || [] } );
    } catch ( err )
    {
        console.error( 'Fetch orders error:', err );
        return NextResponse.json( { error: 'Failed to fetch orders' }, { status: 500 } );
    }
}
