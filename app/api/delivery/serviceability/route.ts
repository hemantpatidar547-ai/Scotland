import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/rate-limit';
import { DelhiveryServiceError, getDelhiveryDeliveryEstimate } from '@/lib/delhivery/serviceability';

const requestSchema = z.object( {
    pincode: z.string().regex( /^[0-9]{6}$/ ),
    chargeableWeightGrams: z.number().int().min( 1 ).max( 100000 ).optional(),
} );

export async function POST ( request: NextRequest )
{
    const rateLimitResponse = await enforceRateLimit( request, {
        scope: 'delivery-serviceability',
        limit: 30,
        windowSeconds: 60,
    } );
    if ( rateLimitResponse ) return rateLimitResponse;

    let body: unknown;
    try
    {
        body = await request.json();
    } catch
    {
        return NextResponse.json( { error: 'Enter a valid 6-digit PIN code.' }, { status: 400 } );
    }

    const parsed = requestSchema.safeParse( body );
    if ( !parsed.success )
        return NextResponse.json( { error: 'Enter a valid 6-digit PIN code.' }, { status: 400 } );

    try
    {
        const estimate = await getDelhiveryDeliveryEstimate(
            parsed.data.pincode,
            parsed.data.chargeableWeightGrams
        );
        return NextResponse.json( {
            status: estimate.serviceable ? 'available' : 'unavailable',
            message: estimate.serviceable
                ? 'Delivery Available'
                : 'Sorry, delivery is not available at this PIN code.',
            estimatedDeliveryDays: estimate.serviceable ? estimate.estimatedDeliveryDays : null,
            chargeableWeightGrams: estimate.chargeableWeightGrams,
            district: estimate.district,
            state: estimate.state,
            cod: {
                available: estimate.codAvailable,
                courierCharge: estimate.codCharge,
            },
            prepaid: {
                available: estimate.prepaidAvailable,
                courierCharge: estimate.prepaidCharge,
            },
        } );
    } catch ( error )
    {
        if ( error instanceof DelhiveryServiceError )
        {
            const invalidInput = error.message.startsWith( 'Enter a valid' );
            return NextResponse.json(
                { error: invalidInput ? error.message : 'Delivery availability is temporarily unavailable. Please try again.' },
                { status: invalidInput ? 400 : 503 }
            );
        }
        console.error( 'Delhivery serviceability check failed.' );
        return NextResponse.json(
            { error: 'Delivery availability is temporarily unavailable. Please try again.' },
            { status: 503 }
        );
    }
}
