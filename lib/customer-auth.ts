import { createClient } from '@/lib/supabase/ssr-server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { getOTPUser } from '@/lib/jwt-auth';

type AuthResult = {
    user: { id: string; email?: string | null; mobile?: string; name?: string; provider: 'otp' | 'supabase' } | null;
    db: ReturnType<typeof getSupabaseAdmin> | null;
};

/**
 * Unified auth check — tries OTP JWT first, then Supabase.
 * Returns user info and Supabase admin DB client for data queries.
 */
export async function getAuthenticatedCustomer (): Promise<AuthResult>
{
    // Check OTP session first
    const otpUser = await getOTPUser();
    if ( otpUser )
    {
        return {
            user: {
                id: otpUser.id,
                email: otpUser.email || null,
                mobile: otpUser.mobile,
                name: otpUser.name,
                provider: 'otp',
            },
            db: getSupabaseAdmin(),
        };
    }

    // Fall back to Supabase
    try
    {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if ( error || !user ) return { user: null, db: null };

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.user_metadata?.full_name as string || '',
                provider: 'supabase',
            },
            db: getSupabaseAdmin(),
        };
    } catch
    {
        return { user: null, db: null };
    }
}
