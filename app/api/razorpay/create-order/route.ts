import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { checkoutCartSchema, getCheckoutShippingCost, priceCheckoutCart } from '@/lib/order-checkout';

const paymentPayload = z.object( { cartItems: checkoutCartSchema } );

export async function POST ( request: NextRequest )
{
    try
    {
        const payload = paymentPayload.safeParse( await request.json() );
        if ( !payload.success ) return NextResponse.json( { error: 'Your cart is invalid. Refresh it and try again.' }, { status: 400 } );

        const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if ( !keyId || !keySecret )
        {
            return NextResponse.json( { error: 'Online payment is not configured. Choose cash on delivery or contact support.' }, { status: 503 } );
        }

        const db = getSupabaseAdmin();
        const pricedCart = await priceCheckoutCart( db, payload.data.cartItems );
        const shippingCost = await getCheckoutShippingCost( db, pricedCart.subtotal );
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
        const unavailable = error instanceof Error &&
            ( error.message.includes( 'no longer available' ) || error.message.includes( 'no longer matches' ) );
        return NextResponse.json(
            { error: unavailable ? error.message : 'Could not initialize online payment. Please try again.' },
            { status: unavailable ? 409 : 500 }
        );
    }
}
