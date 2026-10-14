import { createClient } from '@/lib/supabase/ssr-server'
import { isAdminEmail } from '@/lib/admin-authorization';

export async function isAdminRequest (): Promise<boolean>
{
    try
    {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        return !error && isAdminEmail( user?.email );
    } catch
    {
        return false;
    }
}
