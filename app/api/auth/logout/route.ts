import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/jwt-auth';

export async function POST ()
{
    try
    {
        await clearAuthCookie();

        // Also try to sign out from Supabase if active
        try
        {
            const { createClient } = await import( '@/lib/supabase/ssr-server' );
            const supabase = await createClient();
            await supabase.auth.signOut();
        } catch
        {
            // Supabase not available; that's fine, OTP cookie is cleared.
        }

        return NextResponse.json( { success: true, message: 'Logged out successfully.' } );
    } catch ( error )
    {
        console.error( 'Logout error:', error );
        return NextResponse.json( { error: 'Logout failed.' }, { status: 500 } );
    }
}
