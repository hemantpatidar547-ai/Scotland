import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/ssr-server';
import { isAdminEmail } from '@/lib/admin-authorization';

export async function POST ( request: NextRequest )
{
    const origin = request.headers.get( 'origin' );
    if ( origin && origin !== request.nextUrl.origin )
    {
        return NextResponse.json( { error: 'Invalid request origin.' }, { status: 403 } );
    }

    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if ( !email || !isAdminEmail( email ) )
    {
        return NextResponse.json( { error: 'Admin login is not configured correctly.' }, { status: 503 } );
    }

    try
    {
        const redirectTo = new URL( '/api/auth/callback?redirect=%2Fadmin%2Freset-password', request.nextUrl.origin );
        const supabase = await createClient();
        const { error } = await supabase.auth.resetPasswordForEmail( email, {
            redirectTo: redirectTo.toString(),
        } );

        if ( error )
        {
            console.error( 'Admin password reset request failed:', error.message );
            return NextResponse.json( { error: 'Could not send the password reset email. Check the Supabase email settings and try again.' }, { status: 502 } );
        }

        return NextResponse.json( {
            success: true,
            message: 'If the configured admin account can receive email, a password reset link has been sent.',
        } );
    } catch ( error )
    {
        console.error( 'Admin password reset request failed:', error );
        return NextResponse.json( { error: 'Could not send the password reset email. Please try again.' }, { status: 500 } );
    }
}
