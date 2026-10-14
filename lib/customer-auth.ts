import { createClient } from '@/lib/supabase/ssr-server';
import { getSupabaseAdmin } from '@/lib/supabase/db';

type AuthResult = {
    user: { id: string; email?: string | null; mobile?: string; name?: string; provider: 'supabase' } | null;
    db: ReturnType<typeof getSupabaseAdmin> | null;
};

/** Returns the authenticated Supabase user and the database client used for account data. */
export async function getAuthenticatedCustomer (): Promise<AuthResult>
{
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
