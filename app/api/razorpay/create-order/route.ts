import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { checkoutCartSchema, checkoutShippingAddressSchema, getCheckoutShippingCost, priceCheckoutCart } from '@/lib/order-checkout';
import { enforceRateLimit } from '@/lib/rate-limit';
import { DelhiveryServiceError, getDelhiveryDeliveryEstimate } from '@/lib/delhivery/serviceability';

export async function POST ( request: NextRequest )
{
    try
    {
        const rateLimitResponse = await enforceRateLimit( request, {
            scope: 'razorpay-create-order',
            limit: 10,
            windowSeconds: 60,
        } );
        if ( rateLimitResponse ) return rateLimitResponse;

        const body = await request.json();
        const cart = checkoutCartSchema.safeParse( body.cartItems );
        if ( !cart.success )
            return NextResponse.json( { error: 'Your cart is invalid. Refresh it and try again.' }, { status: 400 } );
        const address = checkoutShippingAddressSchema.safeParse( body.shippingAddress );
        if ( !address.success )
            return NextResponse.json( { error: 'Complete your name, email, street address, city, 6-digit PIN code, and 10-digit phone number before payment.' }, { status: 400 } );

        const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if ( !keyId || !keySecret )
        {
            return NextResponse.json( { error: 'Online payment is not configured. Choose cash on delivery or contact support.' }, { status: 503 } );
        }

        const db = getSupabaseAdmin();
        const pricedCart = await priceCheckoutCart( db, cart.data );
        const deliveryEstimate = await getDelhiveryDeliveryEstimate( address.data.postalCode );
        if ( !deliveryEstimate.serviceable )
            return NextResponse.json( { error: 'Sorry, delivery is not available at this PIN code.' }, { status: 422 } );
        if ( !deliveryEstimate.prepaidAvailable )
            return NextResponse.json( { error: 'Prepaid delivery is not available at this PIN code. Choose another available payment method.' }, { status: 422 } );
        if ( deliveryEstimate.prepaidCharge === null ) throw new DelhiveryServiceError();

        const shippingCost = await getCheckoutShippingCost( db, pricedCart.subtotal, deliveryEstimate.prepaidCharge );
        const amount = pricedCart.subtotal + shippingCost;
        if ( !Number.isFinite( amount ) || amount <= 0 )
        {
            return NextResponse.json( { error: 'The order total is invalid. Please refresh your cart.' }, { status: 400 } );
        }

        const razorpay = new Razorpay( { key_id: keyId, key_secret: keySecret } );
        const order = await razorpay.orders.create( {
            amount: Math.round( amount * 100 ),
            currency: 'INR',
            receipt: `scotland_${ Date.now() }`,
        } );

        return NextResponse.json( order );
    } catch ( error )
    {
        console.error( 'Razorpay create-order error:', error );
        if ( error instanceof DelhiveryServiceError )
        {
            return NextResponse.json(
                { error: 'Delivery availability is temporarily unavailable. Please try again.' },
                { status: 503 }
            );
        }
        const unavailable = error instanceof Error &&
            ( error.message.includes( 'no longer available' ) || error.message.includes( 'no longer matches' ) );
        return NextResponse.json(
            { error: unavailable ? error.message : 'Could not initialize online payment. Please try again.' },
            { status: unavailable ? 409 : 500 }
        );
    }
}
