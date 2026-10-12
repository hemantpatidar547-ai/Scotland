import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with Service Role Key (bypasses RLS)
export function getSupabaseAdmin ()
{
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
}
