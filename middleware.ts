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
        await supabase.auth.getUser();
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