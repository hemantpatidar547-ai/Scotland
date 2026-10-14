import { createClient } from '@supabase/supabase-js';
import { isValidSupabaseUrl } from '@/lib/supabase/is-valid-url';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabase = Boolean( isValidSupabaseUrl( supabaseUrl ) && serviceRoleKey );
export const supabaseAdmin = hasSupabase
    ? createClient( supabaseUrl!, serviceRoleKey!, { auth: { persistSession: false } } )
    : null;
