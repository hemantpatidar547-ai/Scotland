import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import type { CookieSerializeOptions } from 'cookie';

type CookieToSet = { name: string; value: string; options: Partial<CookieSerializeOptions> };

export function createClient ( request: NextRequest )
{
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if ( !supabaseUrl || !supabaseKey )
    {
        throw new Error( 'Supabase middleware environment variables are missing.' );
    }

    let supabaseResponse = NextResponse.next( {
        request: { headers: request.headers }
    } );

    const supabase = createServerClient( supabaseUrl, supabaseKey, {
        cookies: {
            getAll ()
            {
                return request.cookies.getAll();
            },
            setAll ( cookiesToSet: CookieToSet[] )
            {
                cookiesToSet.forEach( ( { name, value } ) => request.cookies.set( name, value ) );
                supabaseResponse = NextResponse.next( { request } );
                cookiesToSet.forEach( ( { name, value, options } ) => supabaseResponse.cookies.set( name, value, options ) );
            }
        }
    } );

    return { supabase, supabaseResponse };
}