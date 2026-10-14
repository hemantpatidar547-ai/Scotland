import { NextRequest, NextResponse } from 'next/server';
import { validateEmail, verifyEmailOtp } from '@/lib/supabase/email-auth';

export async function POST ( request: NextRequest )
{
    try
    {
        const body = await request.json();
        const email = String( body.email || '' ).trim().toLowerCase();
        const otp = String( body.otp || '' ).trim();

        if ( !email || !validateEmail( email ) )
        {
            return NextResponse.json( { error: 'Invalid email address.' }, { status: 400 } );
        }

        if ( !/^\d{4,8}$/.test( otp ) )
        {
            return NextResponse.json( { error: 'Enter a valid OTP.' }, { status: 400 } );
        }

        const user = await verifyEmailOtp( email, otp );

        return NextResponse.json( {
            success: true,
            message: 'Login successful!',
            user: {
                id: user.id,
                name: user.user_metadata?.full_name || '',
                email: user.email || email,
                role: 'customer',
            },
        } );
    } catch ( error )
    {
        console.error( 'Verify OTP error:', error );
        return NextResponse.json(
            { error: 'Could not verify OTP. Please try again.' },
            { status: 500 }
        );
    }
}
