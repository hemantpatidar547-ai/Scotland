import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { createClient } from '@/lib/supabase/ssr-server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { bustProductCache } from '@/lib/data';
import { checkoutCartSchema, checkoutShippingAddressSchema, getCheckoutShippingCost, priceCheckoutCart } from '@/lib/order-checkout';
import { enforceRateLimit } from '@/lib/rate-limit';
import { DelhiveryServiceError, getDelhiveryDeliveryEstimate } from '@/lib/delhivery/serviceability';
import { z } from 'zod';

function secureCompare ( first: string, second: string ): boolean
{
    const firstBuffer = Buffer.from( first );
    const secondBuffer = Buffer.from( second );
    return firstBuffer.length === secondBuffer.length && crypto.timingSafeEqual( firstBuffer, secondBuffer );
}

async function validateRazorpayPayment (
    orderId: string | undefined,
    paymentId: string | undefined,
    signature: string | undefined,
    expectedAmount: number
): Promise<boolean>
{
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if ( !orderId || !paymentId || !signature || !keyId || !keySecret ) return false;

    const expectedSignature = crypto.createHmac( 'sha256', keySecret )
        .update( `${ orderId }|${ paymentId }` )
        .digest( 'hex' );
    if ( !secureCompare( expectedSignature, signature ) ) return false;

    const razorpay = new Razorpay( { key_id: keyId, key_secret: keySecret } );
    const payment = await razorpay.payments.fetch( paymentId );
    return payment.order_id === orderId &&
        payment.status === 'captured' &&
        Number( payment.amount ) === Math.round( expectedAmount * 100 );
}

export async function POST ( request: NextRequest )
{
    try
    {
        const rateLimitResponse = await enforceRateLimit( request, {
            scope: 'order-create',
            limit: 5,
            windowSeconds: 600,
        } );
        if ( rateLimitResponse ) return rateLimitResponse;

        const body = await request.json();
        const cart = checkoutCartSchema.safeParse( body.cartItems );
        const address = checkoutShippingAddressSchema.safeParse( body.shippingAddress );
        if ( !cart.success ) return NextResponse.json( { error: 'Your cart is invalid. Refresh it and try again.' }, { status: 400 } );
        if ( !address.success ) return NextResponse.json( { error: 'Enter a valid delivery address.' }, { status: 400 } );
        if ( body.paymentMethod !== 'cod' && body.paymentMethod !== 'razorpay' )
        {
            return NextResponse.json( { error: 'Choose a valid payment method.' }, { status: 400 } );
        }
        if ( body.returnPolicyAccepted !== true )
            return NextResponse.json( { error: 'Read and accept the delivery, cancellation, and return policy before placing your order.' }, { status: 400 } );

        const auth = await createClient();
        const { data: { user } } = await auth.auth.getUser();
        const db = getSupabaseAdmin();
        const pricedCart = await priceCheckoutCart( db, cart.data );

        const deliveryEstimate = await getDelhiveryDeliveryEstimate( address.data.postalCode );
        if ( !deliveryEstimate.serviceable )
            return NextResponse.json( { error: 'Sorry, delivery is not available at this PIN code.' }, { status: 422 } );

        const methodIsAvailable = body.paymentMethod === 'cod'
            ? deliveryEstimate.codAvailable
            : deliveryEstimate.prepaidAvailable;
        const courierCharge = body.paymentMethod === 'cod'
            ? deliveryEstimate.codCharge
            : deliveryEstimate.prepaidCharge;
        if ( !methodIsAvailable )
            return NextResponse.json( { error: 'The selected payment method is not available at this PIN code.' }, { status: 422 } );
        if ( courierCharge === null )
            throw new DelhiveryServiceError();

        const shippingCost = await getCheckoutShippingCost( db, pricedCart.subtotal, courierCharge );
        const finalAmount = pricedCart.subtotal + shippingCost;
        if ( !Number.isFinite( finalAmount ) || finalAmount <= 0 )
        {
            return NextResponse.json( { error: 'The order total is invalid. Please refresh your cart.' }, { status: 400 } );
        }

        if ( body.paymentMethod === 'razorpay' )
        {
            let isValidPayment = false;
            try
            {
                isValidPayment = await validateRazorpayPayment(
                    body.razorpayOrderId,
                    body.razorpayPaymentId,
                    body.razorpaySignature,
                    finalAmount
                );
            } catch ( error )
            {
                console.error( 'Razorpay payment validation failed:', error );
            }
            if ( !isValidPayment )
            {
                return NextResponse.json( { error: 'Payment could not be verified for this order amount. Contact support if your account was charged.' }, { status: 400 } );
            }
        }

        const orderNumber = `SC-${ Date.now() }-${ crypto.randomUUID().slice( 0, 8 ).toUpperCase() }`;
        const orderPayload = {
            order_number: orderNumber,
            user_id: user?.id || null,
            user_email: user?.email || address.data.email || null,
            email: user?.email || address.data.email || '',
            shipping_address: address.data,
            items: pricedCart.items,
            subtotal: pricedCart.subtotal,
            shipping_cost: shippingCost,
            tax: 0,
            coupon_code: null,
            coupon_discount: 0,
            final_amount: finalAmount,
            total_amount: finalAmount,
            payment_method: body.paymentMethod,
            payment_status: body.paymentMethod === 'cod' ? 'pending' : 'paid',
            razorpay_payment_id: body.paymentMethod === 'razorpay' ? body.razorpayPaymentId : null,
            razorpay_order_id: body.paymentMethod === 'razorpay' ? body.razorpayOrderId : null,
            razorpay_signature: body.paymentMethod === 'razorpay' ? body.razorpaySignature : null,
            order_status: body.paymentMethod === 'cod' ? 'pending_payment' : 'paid',
        };

        const { data: createdOrders, error: orderError } = await db.rpc( 'create_customer_order', {
            p_order: orderPayload,
            p_items: pricedCart.items,
            p_inventory: pricedCart.inventoryReservation,
        } );

        if ( orderError )
        {
            console.error( 'Atomic order creation failed:', orderError );
            const message = orderError.message.toLowerCase();
            if ( message.includes( 'insufficient stock' ) )
            {
                return NextResponse.json( { error: 'The requested quantity is no longer in stock. Please update your cart.' }, { status: 409 } );
            }
            if ( orderError.code === 'PGRST202' && message.includes( 'create_customer_order' ) )
            {
                return NextResponse.json(
                    { error: 'Customer account database setup is incomplete. Run supabase/migrations/0004_customer_accounts.sql in the Supabase SQL Editor.' },
                    { status: 503 }
                );
            }
            return NextResponse.json( { error: 'Could not save your order. Please try again.' }, { status: 500 } );
        }

        const order = Array.isArray( createdOrders ) ? createdOrders[ 0 ] : createdOrders;
        if ( !order?.order_id )
        {
            console.error( 'Atomic order creation returned no order id.' );
            return NextResponse.json( { error: 'Could not confirm that your order was saved. Please contact support before retrying.' }, { status: 500 } );
        }

        bustProductCache();
        return NextResponse.json( { success: true, orderId: order.order_id, orderNumber: order.order_number, finalAmount } );
    } catch ( error )
    {
        console.error( 'Order creation error:', error );
        if ( error instanceof DelhiveryServiceError )
        {
            return NextResponse.json(
                { error: 'Delivery availability is temporarily unavailable. Please try again; your order was not confirmed.' },
                { status: 503 }
            );
        }
        const message = error instanceof Error ? error.message : '';
        const unavailable = message.toLowerCase().includes( 'no longer available' ) ||
            message.toLowerCase().includes( 'no longer matches' );
        return NextResponse.json(
            { error: unavailable ? message : 'Could not create your order. Please refresh your cart and try again.' },
            { status: unavailable ? 409 : 500 }
        );
    }
}

export async function GET ()
{
    try
    {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if ( error || !user ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const db = getSupabaseAdmin();
        const { data: orders, error: orderError } = await db
            .from( 'orders' )
            .select( 'id, order_number, user_email, email, shipping_address, items, subtotal, shipping_cost, tax, coupon_code, coupon_discount, final_amount, total_amount, payment_method, payment_status, order_status, tracking_number, courier_name, created_at, updated_at' )
            .eq( 'user_id', user.id )
            .order( 'created_at', { ascending: false } );

        if ( orderError ) throw orderError;
        return NextResponse.json( { data: orders || [] } );
    } catch ( error )
    {
        console.error( 'Fetch orders error:', error );
        return NextResponse.json( { error: 'Failed to fetch orders' }, { status: 500 } );
    }
}
