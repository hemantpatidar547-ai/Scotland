import { createClient } from '@/lib/supabase/ssr-server';

export function validateEmail ( email: string ): boolean
{
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( email );
}

export async function sendEmailOtp ( email: string, name?: string )
{
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp( {
        email,
        options: {
            shouldCreateUser: true,
            ...( name ? { data: { full_name: name } } : {} ),
        },
    } );

    if ( error ) throw error;
}

export async function verifyEmailOtp ( email: string, token: string )
{
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp( {
        email,
        token,
        type: 'email',
    } );

    if ( error ) throw error;
    if ( !data.user ) throw new Error( 'Supabase verified the code without returning a user.' );
    return data.user;
}
