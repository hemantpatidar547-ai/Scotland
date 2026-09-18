import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

const razorpay = new Razorpay( {
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
} );

export async function POST ( req: NextRequest )
{
    try
    {
        const { amount } = await req.json();

        if ( !amount || amount <= 0 )
            return NextResponse.json( { error: 'Invalid amount' }, { status: 400 } );

        const order = await razorpay.orders.create( {
            amount: Math.round( amount * 100 ),   // paise
            currency: 'INR',
            receipt: `receipt_${ Date.now() }`,
        } );

        return NextResponse.json( order );
    }
    catch ( err: any )
    {
        console.error( 'Razorpay create-order error:', err );
        return NextResponse.json( { error: err.message || 'Failed to create payment order' }, { status: 500 } );
    }
}
