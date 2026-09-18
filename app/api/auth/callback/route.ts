import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/ssr-server';

export async function GET ( request: Request )
{
    const { searchParams, origin } = new URL( request.url );
    const code = searchParams.get( 'code' );
    // if "next" is in searchParams, use it as the redirect URL
    let next = searchParams.get( 'redirect' ) || searchParams.get( 'next' ) || '/';

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
            return NextResponse.redirect( `${ origin }/login?error=Authentication failed` );
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect( `${ origin }/login?error=OAuth Configuration Error` );
}
