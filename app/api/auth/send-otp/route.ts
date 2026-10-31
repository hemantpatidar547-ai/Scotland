import { NextRequest, NextResponse } from 'next/server';
import { sendEmailOtp, validateEmail } from '@/lib/supabase/email-auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function POST ( request: NextRequest )
{
    try
    {
        const body = await request.json();
        const email = String( body.email || '' ).trim().toLowerCase();
        const name = String( body.name || '' ).trim();

        if ( !email || !validateEmail( email ) )
        {
            return NextResponse.json(
                { error: 'Please enter a valid email address.' },
                { status: 400 }
            );
        }

        if ( name && ( name.length < 2 || name.length > 120 ) )
        {
            return NextResponse.json( { error: 'Enter a name between 2 and 120 characters.' }, { status: 400 } );
        }

        const rateLimitResponse = await enforceRateLimit( request, {
            scope: 'auth-otp-send',
            limit: 3,
            windowSeconds: 900,
            subject: email,
        } );
        if ( rateLimitResponse ) return rateLimitResponse;

        await sendEmailOtp( email, name || undefined );

        return NextResponse.json( {
            success: true,
            message: 'Verification code sent to your email.',
            userName: name || null,
        } );
    } catch ( error )
    {
        console.error( 'Send OTP error:', error );
        return NextResponse.json(
            { error: 'Could not send OTP. Please try again.' },
            { status: 500 }
        );
    }
}
