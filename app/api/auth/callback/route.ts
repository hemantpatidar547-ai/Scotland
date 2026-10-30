import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/ssr-server';

export async function GET ( request: Request )
{
    const { searchParams, origin } = new URL( request.url );
    const code = searchParams.get( 'code' );
    // if "next" is in searchParams, use it as the redirect URL
    const requestedNext = searchParams.get( 'redirect' ) || searchParams.get( 'next' ) || '/';
    const next = requestedNext.startsWith( '/' ) && !requestedNext.startsWith( '//' ) ? requestedNext : '/';

    if ( code )
    {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession( code );

        if ( !error )
        {
            // Successful Google login
            return NextResponse.redirect( `${ origin }${ next }` );
        }
        else
        {
            console.error( 'SSO Error:', error );
            const loginUrl = new URL( '/login', origin );
            loginUrl.searchParams.set( 'error', 'oauth_callback_failed' );
            return NextResponse.redirect( loginUrl );
        }
    }

    const loginUrl = new URL( '/login', origin );
    loginUrl.searchParams.set( 'error', 'oauth_callback_missing_code' );
    return NextResponse.redirect( loginUrl );
}
