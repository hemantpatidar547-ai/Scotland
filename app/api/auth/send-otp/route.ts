import { NextRequest, NextResponse } from 'next/server';
import { sendOTP, validateEmail } from '@/lib/email-otp';
import clientPromise from '@/lib/mongodb';

export async function POST ( request: NextRequest )
{
    try
    {
        const body = await request.json();
        const email = String( body.email || '' ).trim().toLowerCase();

        if ( !email || !validateEmail( email ) )
        {
            return NextResponse.json(
                { error: 'Please enter a valid email address.' },
                { status: 400 }
            );
        }

        // Check if user exists in MongoDB
        let isNewUser = true;
        let existingUser = null;

        if ( clientPromise )
        {
            const client = await clientPromise;
            const db = client.db( 'scotland' );
            existingUser = await db.collection( 'customers' ).findOne( { email } );
            isNewUser = !existingUser;
        }

        // Send OTP via email
        const result = await sendOTP( email );

        if ( !result.success )
        {
            return NextResponse.json( { error: result.message }, { status: 500 } );
        }

        return NextResponse.json( {
            success: true,
            message: result.message,
            isNewUser,
            userName: existingUser?.name || null,
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
