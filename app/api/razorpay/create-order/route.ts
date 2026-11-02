import { NextResponse } from 'next/server';

export async function POST ()
{
    return NextResponse.json(
        { error: 'Razorpay checkout has been retired. Please use Cashfree Checkout.' },
        { status: 410 }
    );
}
