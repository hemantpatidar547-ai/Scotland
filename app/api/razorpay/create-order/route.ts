import { NextResponse } from 'next/server';

export async function POST ( request: Request )
{
    try
    {
        const { amount } = await request.json();

        const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if ( !keyId || !keySecret )
        {
            return NextResponse.json(
                { error: 'Razorpay API keys not found in .env.local' },
                { status: 500 }
            );
        }

        const authHeader = 'Basic ' + Buffer.from( `${ keyId }:${ keySecret }` ).toString( 'base64' );

        const res = await fetch( 'https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authHeader,
            },
            body: JSON.stringify( {
                amount: Math.round( amount * 100 ), // Amount in paisa
                currency: 'INR',
                receipt: `rcptid_${ Date.now() }`,
            } ),
        } );

        const data = await res.json();

        if ( !res.ok )
        {
            return NextResponse.json( { error: data.error?.description || 'Error creating order' }, { status: res.status } );
        }

        return NextResponse.json( data );
    } catch ( error: any )
    {
        console.error( 'Razorpay Order Error:', error );
        return NextResponse.json( { error: error.message }, { status: 500 } );
    }
}
