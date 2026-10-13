import { NextResponse } from 'next/server';
import { getOTPUser } from '@/lib/jwt-auth';
import { createClient } from '@/lib/supabase/ssr-server';

/**
 * Unified session endpoint — checks both OTP JWT and Supabase sessions.
 */
export async function GET ()
{
    try
    {
        // Check OTP-based JWT session first
        const otpUser = await getOTPUser();
        if ( otpUser )
        {
            return NextResponse.json( {
                authenticated: true,
                provider: 'otp',
                user: {
                    id: otpUser.id,
                    name: otpUser.name,
                    mobile: otpUser.mobile,
                    email: otpUser.email,
                    role: otpUser.role,
                },
            } );
        }

        // Check Supabase session
        try
        {
            const supabase = await createClient();
            const { data: { user }, error } = await supabase.auth.getUser();

            if ( !error && user )
            {
                return NextResponse.json( {
                    authenticated: true,
                    provider: 'supabase',
                    user: {
                        id: user.id,
                        name: user.user_metadata?.full_name || '',
                        email: user.email || '',
                        mobile: user.phone || '',
                        role: 'customer', // Admin check is separate
                    },
                } );
            }
        } catch
        {
            // Supabase not configured; skip
        }

        return NextResponse.json( { authenticated: false }, { status: 401 } );
    } catch ( error )
    {
        console.error( 'Session check error:', error );
        return NextResponse.json( { authenticated: false }, { status: 401 } );
    }
}
