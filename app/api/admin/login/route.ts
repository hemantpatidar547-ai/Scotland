import { NextRequest, NextResponse } from 'next/server';
import { createAdminSession, getAdminSessionCookieName, getAdminSessionMaxAge, verifyAdminPassword } from '@/lib/admin-session';
import { isAdminEmail } from '@/lib/admin-authorization';

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
    const adminPassword = process.env.ADMIN_PASSWORD;
    if ( !adminName || !adminMobile || !adminEmail || !adminPassword || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( adminEmail ) )
    {
        return NextResponse.json(
            { error: 'Admin login is not configured. Set ADMIN_NAME, ADMIN_MOBILE, ADMIN_EMAIL, and ADMIN_PASSWORD.' },
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

        if ( !isAdminEmail( adminEmail ) || !await verifyAdminPassword( password ) )
        {
            return NextResponse.json( { error: 'The admin details or password are incorrect.' }, { status: 401 } );
        }

        const response = NextResponse.json( { success: true } );
        response.cookies.set( getAdminSessionCookieName(), await createAdminSession(), {
            httpOnly: true,
            secure: request.nextUrl.protocol === 'https:',
            sameSite: 'strict',
            path: '/',
            maxAge: getAdminSessionMaxAge(),
        } );
        return response;
    } catch ( error )
    {
        console.error( 'Admin sign-in failed:', error );
        return NextResponse.json( { error: 'Could not sign in. Please try again.' }, { status: 500 } );
    }
}
