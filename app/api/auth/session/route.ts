import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/ssr-server';

export async function GET ()
{
    try
    {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        if ( error || !user ) return NextResponse.json( { authenticated: false }, { status: 401 } );

        return NextResponse.json( {
            authenticated: true,
            provider: 'supabase',
            user: {
                id: user.id,
                name: user.user_metadata?.full_name || '',
                email: user.email || '',
                mobile: user.phone || '',
                role: 'customer',
            },
        } );
    } catch ( error )
    {
        console.error( 'Session check error:', error );
        return NextResponse.json( { authenticated: false }, { status: 401 } );
    }
}
