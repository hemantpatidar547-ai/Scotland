import { NextRequest, NextResponse } from 'next/server';

const TOKEN_COOKIE = 'scotland-auth-token';

const ADMIN_MOBILES = [
    process.env.ADMIN_MOBILE || '',
].filter( Boolean );

const ADMIN_EMAILS = [
    'patidarhemant226@gmail.com',
    'hemantpatidar547@gmail.com',
    process.env.ADMIN_EMAIL || '',
].map( e => e.trim().toLowerCase() ).filter( Boolean );

/**
 * Decode JWT payload WITHOUT crypto (safe for Edge runtime / middleware).
 * Full signature verification happens inside API routes via getOTPUser().
 */
function decodeTokenPayload ( token: string ): Record<string, unknown> | null
{
    try
    {
        const parts = token.split( '.' );
        if ( parts.length !== 3 ) return null;
        const raw = parts[ 1 ].replace( /-/g, '+' ).replace( /_/g, '/' );
        const padded = raw + '==='.slice( ( raw.length + 3 ) % 4 );
        const json = Buffer.from( padded, 'base64' ).toString( 'utf-8' );
        const decoded = JSON.parse( json );
        // Check expiry
        if ( decoded.exp && decoded.exp < Math.floor( Date.now() / 1000 ) ) return null;
        return decoded;
    } catch
    {
        return null;
    }
}

function getOTPPayload ( cookieHeader: string | null ): Record<string, unknown> | null
{
    if ( !cookieHeader ) return null;
    const match = cookieHeader.match( new RegExp( `(?:^|;\\s*)${ TOKEN_COOKIE }=([^;]+)` ) );
    if ( !match ) return null;
    return decodeTokenPayload( match[ 1 ] );
}

function isAdminPayload ( payload: Record<string, unknown> | null ): boolean
{
    if ( !payload ) return false;
    if ( payload.role === 'admin' ) return true;
    const mobile = String( payload.mobile || '' ).replace( /\D/g, '' ).slice( -10 );
    if ( mobile && ADMIN_MOBILES.some( m => m.replace( /\D/g, '' ).slice( -10 ) === mobile ) ) return true;
    const email = String( payload.email || '' ).trim().toLowerCase();
    if ( email && ADMIN_EMAILS.includes( email ) ) return true;
    return false;
}

export async function middleware ( request: NextRequest )
{
    const path = request.nextUrl.pathname;
    const cookieHeader = request.headers.get( 'cookie' );

    // ── Check OTP JWT (Edge-safe decode) ──
    const otpPayload = getOTPPayload( cookieHeader );
    const isOTPAuthenticated = otpPayload !== null;
    const isOTPAdmin = isAdminPayload( otpPayload );

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

    const supabaseEmail = supabaseUser?.email?.trim().toLowerCase() || '';
    const isSupabaseAdmin = supabaseEmail ? ADMIN_EMAILS.includes( supabaseEmail ) : false;

    const isAuthenticated = isOTPAuthenticated || Boolean( supabaseUser );
    const isAdmin = isOTPAdmin || isSupabaseAdmin;

    // ── Admin panel protection ──
    if ( path.startsWith( '/admin' ) )
    {
        if ( !isAuthenticated )
        {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            url.searchParams.set( 'redirect', path );
            return NextResponse.redirect( url );
        }
        if ( !isAdmin )
        {
            const url = request.nextUrl.clone();
            url.pathname = '/';
            return NextResponse.redirect( url );
        }
    }

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
        url.pathname = '/';
        return NextResponse.redirect( url );
    }

    return supabaseResponse || NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};