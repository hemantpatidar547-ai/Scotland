import { DEFAULT_HOMEPAGE_SHOWCASE, type HomepageShowcase } from '@/types/homepage-showcase';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { isValidSupabaseUrl } from '@/lib/supabase/is-valid-url';

export async function getHomepageShowcase (): Promise<HomepageShowcase>
{
    if ( !isValidSupabaseUrl( process.env.NEXT_PUBLIC_SUPABASE_URL ) || !process.env.SUPABASE_SERVICE_ROLE_KEY )
    {
        console.warn( 'Homepage showcase is using defaults because Supabase is not configured.' );
        return DEFAULT_HOMEPAGE_SHOWCASE;
    }

    const db = getSupabaseAdmin();
    const { data, error } = await db.from( 'settings' )
        .select( 'homepage_showcase' )
        .eq( 'id', 'store' )
        .maybeSingle();

    if ( error )
    {
        if ( error.code === '42703' || error.code === 'PGRST204' )
        {
            console.warn( 'Homepage content management is unavailable until supabase/migrations/0007_homepage_showcase.sql is applied.' );
            return DEFAULT_HOMEPAGE_SHOWCASE;
        }
        console.error( `Failed to load homepage showcase settings: ${ error.message }` );
        throw new Error( 'Could not load homepage content.' );
    }

    return data?.homepage_showcase
        ? { ...DEFAULT_HOMEPAGE_SHOWCASE, ...data.homepage_showcase }
        : DEFAULT_HOMEPAGE_SHOWCASE;
}
