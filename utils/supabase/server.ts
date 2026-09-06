import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { CookieSerializeOptions } from 'cookie';

type CookieToSet = { name: string; value: string; options: Partial<CookieSerializeOptions> };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function createClient ()
{
    const cookieStore = await cookies();

    return createServerClient( supabaseUrl!, supabaseKey!, {
        cookies: {
            getAll ()
            {
                return cookieStore.getAll();
            },
            setAll ( cookiesToSet: CookieToSet[] )
            {
                try
                {
                    cookiesToSet.forEach( ( { name, value, options } ) => cookieStore.set( name, value, options ) );
                } catch
                {
                    // Server Components cannot always write cookies; middleware refreshes them.
                }
            }
        }
    } );
}