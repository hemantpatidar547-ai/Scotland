'use server';

import { createClient } from '@/lib/supabase/ssr-server';
import { redirect } from 'next/navigation';

export async function logoutAuth ()
{
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect( '/' );
}
