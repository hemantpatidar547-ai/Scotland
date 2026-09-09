import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/middleware';

export async function middleware ( request: NextRequest )
{
    if ( !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY )
    {
        return NextResponse.next();
    }

    try
    {
        const { supabase, supabaseResponse } = createClient( request );
        const { data: { user } } = await supabase.auth.getUser();

        const path = request.nextUrl.pathname;

        // Admin panel protection
        if ( path.startsWith( '/admin' ) )
        {
            if ( !user )
            {
                const url = request.nextUrl.clone();
                url.pathname = '/login';
                url.searchParams.set( 'redirect', path );
                return NextResponse.redirect( url );
            } else if ( user.email !== 'patidarhemant226@gmail.com' )
            {
                // Not authorized as admin
                const url = request.nextUrl.clone();
                url.pathname = '/';
                return NextResponse.redirect( url );
            }
        }

        if ( !user && ( path.startsWith( '/checkout' ) || path.startsWith( '/account' ) ) )
        {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            url.searchParams.set( 'redirect', path );
            return NextResponse.redirect( url );
        }

        if ( user && path === '/login' )
        {
            const url = request.nextUrl.clone();
            url.pathname = '/';
            return NextResponse.redirect( url );
        }

        return supabaseResponse;
    } catch ( error )
    {
        console.error( 'Supabase middleware error:', error );
        return NextResponse.next();
    }
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
    ]
};