import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin-authorization';
import { createClient } from '@/lib/supabase/ssr-server';

export async function POST ( request: NextRequest )
{
    const origin = request.headers.get( 'origin' );
    if ( origin && origin !== request.nextUrl.origin )
    {
        return NextResponse.json( { error: 'Invalid request origin.' }, { status: 403 } );
    }

    const adminName = process.env.ADMIN_NAME?.trim();
    const adminMobile = process.env.ADMIN_MOBILE?.replace( /\D/g, '' );
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if ( !adminName || !adminMobile || !adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( adminEmail ) )
    {
        return NextResponse.json(
            { error: 'Admin login is not configured. Set ADMIN_NAME, ADMIN_MOBILE, and ADMIN_EMAIL.' },
            { status: 503 }
        );
    }

    try
    {
        const body = await request.json();
        const name = String( body.name || '' ).trim();
        const mobile = String( body.mobile || '' ).replace( /\D/g, '' );
        const submittedEmail = String( body.email || '' ).trim().toLowerCase();
        const password = String( body.password || '' );
        const emailLocalPart = adminEmail.split( '@' )[ 0 ];
        const emailMatches = submittedEmail === adminEmail || submittedEmail === emailLocalPart;

        if ( name.toLowerCase() !== adminName.toLowerCase() ||
            mobile !== adminMobile ||
            !emailMatches ||
            !password )
        {
            return NextResponse.json( { error: 'The admin details could not be verified.' }, { status: 401 } );
        }

        if ( !isAdminEmail( adminEmail ) )
        {
            return NextResponse.json( { error: 'The configured admin email is not allowlisted.' }, { status: 503 } );
        }

        const supabase = await createClient();
        const { data, error } = await supabase.auth.signInWithPassword( {
            email: adminEmail,
            password,
        } );

        if ( error || !data.user || !isAdminEmail( data.user.email ) )
        {
            return NextResponse.json( { error: 'The Supabase password is incorrect. Use “Forgot password” to reset it.' }, { status: 401 } );
        }

        return NextResponse.json( { success: true } );
    } catch ( error )
    {
        console.error( 'Admin sign-in failed:', error );
        return NextResponse.json( { error: 'Could not sign in. Please try again.' }, { status: 500 } );
    }
}
