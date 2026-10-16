import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionCookieName } from '@/lib/admin-session';
import { isAdminRequest } from '@/lib/admin-auth';

export async function POST ( request: NextRequest )
{
    if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    const response = NextResponse.json( { success: true, message: 'Logged out successfully.' } );
    response.cookies.set( getAdminSessionCookieName(), '', {
        httpOnly: true,
        secure: request.nextUrl.protocol === 'https:',
        sameSite: 'strict',
        path: '/',
        maxAge: 0,
    } );
    return response;
}
