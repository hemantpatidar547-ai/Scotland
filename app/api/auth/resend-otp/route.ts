import { NextRequest, NextResponse } from 'next/server';
import { sendEmailOtp, validateEmail } from '@/lib/supabase/email-auth';

export async function POST ( request: NextRequest )
{
    try
    {
        const body = await request.json();
        const email = String( body.email || '' ).trim().toLowerCase();

        if ( !email || !validateEmail( email ) )
        {
            return NextResponse.json( { error: 'Invalid email address.' }, { status: 400 } );
        }

        await sendEmailOtp( email );

        return NextResponse.json( { success: true, message: 'Verification code sent to your email.' } );
    } catch ( error )
    {
        console.error( 'Resend OTP error:', error );
        return NextResponse.json( { error: 'Could not resend OTP.' }, { status: 500 } );
    }
}
