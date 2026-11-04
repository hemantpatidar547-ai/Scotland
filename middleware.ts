import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionCookieName, verifyAdminSession } from '@/lib/admin-session';

export async function middleware ( request: NextRequest )
{
    const path = request.nextUrl.pathname;

    // Admin pages and APIs use the signed admin-session cookie, not a Supabase user session.
    // Admin API handlers verify that cookie themselves, so skip the extra Supabase round trip.
    if ( path === '/api/admin' || path.startsWith( '/api/admin/' ) )
        return NextResponse.next();

    if ( path === '/admin' || path.startsWith( '/admin/' ) )
    {
        if ( path !== '/admin/login' )
        {
            const isAdmin = await verifyAdminSession( request.cookies.get( getAdminSessionCookieName() )?.value );
            if ( !isAdmin )
            {
                const url = request.nextUrl.clone();
                url.pathname = '/admin/login';
                url.searchParams.set( 'redirect', path );
                return NextResponse.redirect( url );
            }
        }

        return NextResponse.next();
    }

    // ── Check Supabase session (only if Supabase env vars present) ──
    let supabaseUser: { email?: string | null } | null = null;
    let supabaseResponse: NextResponse | null = null;

    if ( process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY )
    {
        try
        {
            const { createClient } = await import( '@/utils/supabase/middleware' );
            const result = createClient( request );
            supabaseResponse = result.supabaseResponse;
            const { data: { user } } = await result.supabase.auth.getUser();
            supabaseUser = user;
        } catch
        {
            // Supabase not configured — skip silently
        }
    }

    const isAuthenticated = Boolean( supabaseUser );

    // ── Account pages protection ──
    if ( !isAuthenticated && path.startsWith( '/account' ) )
    {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set( 'redirect', path );
        return NextResponse.redirect( url );
    }

    // ── Redirect already-logged-in users away from /login ──
    if ( isAuthenticated && path === '/login' )
    {
        const url = request.nextUrl.clone();
        const requestedRedirect = request.nextUrl.searchParams.get( 'redirect' );
        url.pathname = requestedRedirect?.startsWith( '/' ) && !requestedRedirect.startsWith( '//' )
            ? requestedRedirect
            : '/';
        return NextResponse.redirect( url );
    }

    return supabaseResponse || NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};