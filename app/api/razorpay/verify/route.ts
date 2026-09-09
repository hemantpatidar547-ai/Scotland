import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST ( request: Request )
{
    try
    {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if ( !keySecret )
        {
            return NextResponse.json( { error: 'Razorpay secret not configured' }, { status: 500 } );
        }

        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac( 'sha256', keySecret )
            .update( body.toString() )
            .digest( 'hex' );

        if ( expectedSignature === razorpay_signature )
        {
            return NextResponse.json( { success: true, message: 'Payment verified successfully' } );
        } else
        {
            return NextResponse.json( { error: 'Invalid Payment Signature' }, { status: 400 } );
        }
    } catch ( error: any )
    {
        console.error( 'Razorpay Verify Error:', error );
        return NextResponse.json( { error: error.message }, { status: 500 } );
    }
}
