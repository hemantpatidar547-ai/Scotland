import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/ssr-server';

const passwordSchema = z.object( { password: z.string().min( 8 ).max( 128 ) } );

export async function PUT ( request: NextRequest )
{
    const origin = request.headers.get( 'origin' );
    if ( origin && origin !== request.nextUrl.origin ) return NextResponse.json( { error: 'Invalid request origin.' }, { status: 403 } );

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if ( authError || !user ) return NextResponse.json( { error: 'Your password reset link is invalid or has expired. Request a new one.' }, { status: 401 } );

    const payload = passwordSchema.safeParse( await request.json() );
    if ( !payload.success ) return NextResponse.json( { error: 'Password must be between 8 and 128 characters.' }, { status: 400 } );

    const { error } = await supabase.auth.updateUser( { password: payload.data.password } );
    if ( error )
    {
        console.error( 'Password update failed:', error.message );
        return NextResponse.json( { error: 'We could not update your password. Please request a new reset link.' }, { status: 400 } );
    }

    return NextResponse.json( { success: true } );
}
