import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/ssr-server';

export async function POST ()
{
    try
    {
        const supabase = await createClient();
        const { error } = await supabase.auth.signOut();
        if ( error ) throw error;

        return NextResponse.json( { success: true, message: 'Logged out successfully.' } );
    } catch ( error )
    {
        console.error( 'Logout error:', error );
        return NextResponse.json( { error: 'Logout failed.' }, { status: 500 } );
    }
}
