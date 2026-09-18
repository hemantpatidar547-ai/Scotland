import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST ( req: NextRequest )
{
    try
    {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        } = await req.json();

        if ( !razorpay_order_id || !razorpay_payment_id || !razorpay_signature )
            return NextResponse.json( { error: 'Missing payment fields' }, { status: 400 } );

        const expectedSignature = crypto
            .createHmac( 'sha256', process.env.RAZORPAY_KEY_SECRET! )
            .update( `${ razorpay_order_id }|${ razorpay_payment_id }` )
            .digest( 'hex' );

        if ( expectedSignature === razorpay_signature )
        {
            return NextResponse.json( { success: true } );
        }
        else
        {
            return NextResponse.json( { success: false, error: 'Invalid signature' }, { status: 400 } );
        }
    }
    catch ( err: any )
    {
        console.error( 'Razorpay verify error:', err );
        return NextResponse.json( { error: 'Verification failed' }, { status: 500 } );
    }
}
