import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/rate-limit';
import { syncCashfreeCheckout } from '@/lib/cashfree-payment';

const requestSchema = z.object( {
    orderId: z.string().min( 1 ).max( 50 ).regex( /^[A-Za-z0-9_-]+$/ ),
} );

export async function POST ( request: NextRequest )
{
    try
    {
        const rateLimitResponse = await enforceRateLimit( request, {
            scope: 'cashfree-verify',
            limit: 20,
            windowSeconds: 60,
        } );
        if ( rateLimitResponse ) return rateLimitResponse;

        const parsed = requestSchema.safeParse( await request.json() );
        if ( !parsed.success )
            return NextResponse.json( { error: 'A valid Cashfree order ID is required.' }, { status: 400 } );

        const result = await syncCashfreeCheckout( parsed.data.orderId );
        return NextResponse.json( result );
    } catch ( error )
    {
        console.error( 'Cashfree payment verification failed:', error );
        return NextResponse.json(
            { error: 'We could not confirm the payment status yet. Your cart is unchanged; check again shortly.' },
            { status: 503 }
        );
    }
}
