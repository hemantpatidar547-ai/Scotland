import { getSupabaseAdmin } from '@/lib/supabase/db';

export type StoreCategory = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    seo_title: string | null;
    seo_description: string | null;
    is_active: boolean;
    updated_at: string;
};

export async function getPublicCategories (): Promise<StoreCategory[]>
{
    const db = getSupabaseAdmin();
    const { data, error } = await db.from( 'categories' )
        .select( 'id, name, slug, description, seo_title, seo_description, is_active, updated_at' )
        .eq( 'is_active', true )
        .order( 'name' );
    if ( error )
    {
        console.error( `Failed to fetch public SEO categories: ${ error.message }` );
        throw new Error( 'Could not load public categories.' );
    }
    return data || [];
}

export async function getPublicCategoryBySlug ( slug: string ): Promise<StoreCategory | undefined>
{
    const db = getSupabaseAdmin();
    const { data, error } = await db.from( 'categories' )
        .select( 'id, name, slug, description, seo_title, seo_description, is_active, updated_at' )
        .eq( 'slug', slug )
        .eq( 'is_active', true )
        .maybeSingle();
    if ( error )
    {
        console.error( `Failed to fetch SEO category "${ slug }": ${ error.message }` );
        throw new Error( 'Could not load category page.' );
    }
    return data || undefined;
}

export async function getCategorySlugRedirect ( oldSlug: string ): Promise<string | undefined>
{
    const db = getSupabaseAdmin();
    const { data, error } = await db.from( 'category_slug_redirects' )
        .select( 'categories!inner(slug)' )
        .eq( 'old_slug', oldSlug )
        .maybeSingle();
    if ( error )
    {
        if ( error.code === '42P01' || error.code === 'PGRST205' )
        {
            console.warn( 'Category slug redirects are unavailable until supabase/migrations/0005_product_slug_redirects.sql is applied.' );
            return undefined;
        }
        console.error( `Could not resolve category redirect "${ oldSlug }": ${ error.message }` );
        throw new Error( 'Could not resolve category URL redirect.' );
    }
    const category = Array.isArray( data?.categories ) ? data.categories[ 0 ] : data?.categories;
    return category?.slug;
}
