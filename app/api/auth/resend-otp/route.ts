import { NextRequest, NextResponse } from 'next/server';
import { resendOTP, validateEmail } from '@/lib/email-otp';

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

        const result = await resendOTP( email );

        if ( !result.success )
        {
            return NextResponse.json( { error: result.message }, { status: 500 } );
        }

        return NextResponse.json( { success: true, message: result.message } );
    } catch ( error )
    {
        console.error( 'Resend OTP error:', error );
        return NextResponse.json( { error: 'Could not resend OTP.' }, { status: 500 } );
    }
}
