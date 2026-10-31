import { Product } from '@/types/product';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isValidSupabaseUrl } from '@/lib/supabase/is-valid-url';

// ─── Singleton Supabase clients ──────────────────────────────────────────────
let _supabaseAdmin: SupabaseClient | null = null;
let _supabaseAnon: SupabaseClient | null = null;

function getSupabaseAdmin (): SupabaseClient | null
{
    if ( _supabaseAdmin ) return _supabaseAdmin;
    if ( isValidSupabaseUrl( process.env.NEXT_PUBLIC_SUPABASE_URL ) && process.env.SUPABASE_SERVICE_ROLE_KEY )
    {
        _supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { persistSession: false } }
        );
    }
    return _supabaseAdmin;
}

function getSupabaseAnon (): SupabaseClient | null
{
    if ( _supabaseAnon ) return _supabaseAnon;
    if ( isValidSupabaseUrl( process.env.NEXT_PUBLIC_SUPABASE_URL ) && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY )
    {
        _supabaseAnon = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
            { auth: { persistSession: false } }
        );
    }
    return _supabaseAnon;
}

function getSupabase (): SupabaseClient | null
{
    return getSupabaseAdmin() ?? getSupabaseAnon();
}

// ─── In-memory cache (no size limit, lives in Node.js process) ───────────────
const CACHE_TTL_MS = 60_000; // 60 seconds

let _cachedProducts: Product[] | null = null;
let _cacheTimestamp = 0;
const PRODUCT_QUERY_BATCH_SIZE = 2;

function isTransientNetworkError ( error: { message?: string; details?: string | null } ): boolean
{
    const message = `${ error.message || '' } ${ error.details || '' }`;
    return /fetch failed|enotfound|eai_again|econnreset|etimedout|network error/i.test( message );
}

function wait ( milliseconds: number ): Promise<void>
{
    return new Promise( resolve => setTimeout( resolve, milliseconds ) );
}

const PRODUCT_SELECT = `
    id, slug, sku, name, description, short_description, gender, brand_name, price, mrp, sale_price, discount, updated_at,
    average_rating, review_count, material, tax_percentage, cost_price, style_origin, occasion,
    is_new_arrival, is_best_seller, is_featured, status, product_metadata,
    categories(name, slug, description, seo_title, seo_description),
    product_variants(id, sku, color, size, price, sale_price, stock_quantity, reserved_quantity, is_active, image_url),
    product_images(id, image_url, alt_text, display_order, is_primary)
`;

export function bustProductCache ()
{
    _cachedProducts = null;
    _cacheTimestamp = 0;
}

// ─── Formatter ───────────────────────────────────────────────────────────────
function formatSupabaseProduct ( product: any ): Product
{
    const variant = product.product_variants?.[ 0 ];
    const metadata = product.product_metadata || {};
    const variants = ( product.product_variants || [] ).filter( ( item: any ) => item.is_active !== false );
    const colors = Array.from( new Set<string>( variants.map( ( v: any ) => v.color ).filter( Boolean ) ) );
    const sizes = Array.from( new Set<string>( variants.map( ( v: any ) => v.size ).filter( Boolean ) ) );

    // Calculate total stock remaining for each specific size across all colors
    const sizeStock = variants.reduce( ( acc: Record<string, number>, v: any ) =>
    {
        if ( v.size )
        {
            acc[ v.size ] = ( acc[ v.size ] || 0 ) + ( Number( v.stock_quantity ) || 0 );
        }
        return acc;
    }, {} );

    const productImages = [ ...( product.product_images || [] ) ]
        .sort( ( first: any, second: any ) => Number( first.display_order || 0 ) - Number( second.display_order || 0 ) );
    const primaryImage = productImages.find( ( i: any ) => i.is_primary ) || productImages[ 0 ];
    const image = primaryImage?.image_url
        || productImages[ 0 ]?.image_url
        || variant?.image_url
        || '/images/brand/scotland-lion.png'; return {
            id: product.id,
            slug: product.slug,
            sku: product.sku,
            name: product.name,
            updatedAt: product.updated_at,
            description: product.description,
            shortDescription: product.short_description || product.description,
            category: product.categories?.name || metadata.category || 'Clothing',
            subcategory: metadata.subcategory,
            gender: product.gender || 'Unisex',
            price: Number( product.price ),
            mrp: product.mrp ? Number( product.mrp ) : ( metadata.mrp ? Number( metadata.mrp ) : undefined ),
            salePrice: product.sale_price ? Number( product.sale_price ) : undefined,
            discount: product.discount ? Number( product.discount ) : undefined,
            rating: Number( product.average_rating || 0 ),
            reviews: Number( product.review_count || 0 ),
            image,
            images: productImages.length ? productImages.map( ( item: any ) => item.image_url ) : [ image ],
            colors: colors.length ? colors : [ 'Default' ],
            sizes: sizes.length ? sizes : [ 'One size' ],
            material: product.material || 'Not specified',
            fabric: metadata.fabric,
            fit: metadata.fit,
            pattern: metadata.pattern,
            sleeve: metadata.sleeve,
            collar: metadata.collar,
            weight: metadata.weight,
            dimensions: metadata.dimensions,
            cod: metadata.cod,
            tags: metadata.tags,
            size_chart: metadata.size_chart,
            low_stock_alert: metadata.low_stock_alert,
            stock_status: metadata.stock_status,
            seo_title: metadata.seo_title,
            meta_description: metadata.meta_description,
            focus_keyword: metadata.focus_keyword,
            canonical_url: metadata.canonical_url,
            no_index: metadata.no_index === true,
            image_alt_text: primaryImage?.alt_text || product.name,
            brand_name: product.brand_name || 'SCOTLAND',
            gtin: metadata.gtin,
            mpn: metadata.mpn,
            cost_price: product.cost_price ? Number( product.cost_price ) : undefined,
            gst: product.tax_percentage ? `${ Number( product.tax_percentage ) }%` : '0%',
            stock: variants.reduce( ( total: number, v: any ) => total + ( Number( v.stock_quantity ) || 0 ), 0 ),
            sizeStock,
            inventoryVariants: variants.map( ( v: any ) => ( {
                id: v.id,
                color: v.color || 'Default',
                size: v.size || 'One size',
                stockQuantity: Math.max( 0, ( Number( v.stock_quantity ) || 0 ) - ( Number( v.reserved_quantity ) || 0 ) ),
                sku: v.sku || undefined,
                price: v.price == null ? undefined : Number( v.price ),
                salePrice: v.sale_price == null ? undefined : Number( v.sale_price ),
            } ) ),
            styleOrigin: product.style_origin || 'Scotland',
            occasion: product.occasion || 'Everyday',
            isNew: product.is_new_arrival,
            isBestSeller: product.is_best_seller,
            best_seller: product.is_best_seller,
            featured: product.is_featured,
            status: product.status === 'active' || product.status === 'published' ? 'published' : 'draft',
        };
}

// ─── Raw fetcher (hits DB) ────────────────────────────────────────────────────
async function fetchAllProductsFromDB (): Promise<Product[]>
{
    if ( process.env.NEXT_PUBLIC_SUPABASE_URL && !isValidSupabaseUrl( process.env.NEXT_PUBLIC_SUPABASE_URL ) )
    {
        console.error( 'Invalid NEXT_PUBLIC_SUPABASE_URL. Set it to the Supabase Project URL, for example https://your-project.supabase.co.' );
    }

    const supabase = getSupabase();

    if ( supabase )
    {
        const products: Product[] = [];
        let offset = 0;
        while ( true )
        {
            let result = await supabase
                .from( 'products' )
                .select( PRODUCT_SELECT )
                .eq( 'status', 'active' )
                .order( 'id' )
                .range( offset, offset + PRODUCT_QUERY_BATCH_SIZE - 1 );

            if ( result.error && isTransientNetworkError( result.error ) )
            {
                await wait( 400 );
                result = await supabase
                    .from( 'products' )
                    .select( PRODUCT_SELECT )
                    .eq( 'status', 'active' )
                    .order( 'id' )
                    .range( offset, offset + PRODUCT_QUERY_BATCH_SIZE - 1 );
            }

            const { data, error } = result;

            if ( error )
            {
                console.error(
                    `Failed to fetch Supabase products at offset ${ offset}: ` +
                    `code=${ error.code || 'unknown' }; message=${ error.message }; ` +
                    `details=${ error.details || 'none' }; hint=${ error.hint || 'none' }`
                );
                if ( isTransientNetworkError( error ) )
                {
                    throw new Error( 'Could not reach Supabase. Check that NEXT_PUBLIC_SUPABASE_URL matches the active project URL and that Supabase is available.' );
                }
                throw new Error( `Could not load products from Supabase: ${ error.message }` );
            }

            const batch = data || [];
            products.push( ...batch.map( formatSupabaseProduct ) );
            if ( batch.length < PRODUCT_QUERY_BATCH_SIZE ) break;
            offset += batch.length;
        }

        return products;
    }

    throw new Error( 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and a Supabase key.' );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns all products.
 * Uses a 60-second in-memory cache (no size limit — avoids 2MB Next.js cache cap).
 */
export async function getAllProducts ( fresh = false ): Promise<Product[]>
{
    const now = Date.now();
    if ( !fresh && _cachedProducts && ( now - _cacheTimestamp ) < CACHE_TTL_MS )
    {
        return _cachedProducts;
    }

    try
    {
        const products = await fetchAllProductsFromDB();
        _cachedProducts = products;
        _cacheTimestamp = Date.now();
        return products;
    } catch ( error )
    {
        if ( !fresh && _cachedProducts )
        {
            console.warn( 'Supabase product refresh failed; serving the last successful product data for this server process.', error );
            return _cachedProducts;
        }
        throw error;
    }
}

export async function getProductsByIds ( productIds: string[] ): Promise<Product[]>
{
    const uniqueIds = Array.from( new Set( productIds ) );
    if ( !uniqueIds.length ) return [];

    const supabase = getSupabase();
    if ( !supabase ) throw new Error( 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and a Supabase key.' );

    const { data, error } = await supabase
        .from( 'products' )
        .select( PRODUCT_SELECT )
        .in( 'id', uniqueIds );

    if ( error )
    {
        console.error( 'Failed to fetch saved cart products from Supabase:', error );
        throw new Error( 'Could not load products for your saved cart.' );
    }

    return ( data || [] ).map( formatSupabaseProduct );
}

/**
 * Returns a single product by slug.
 * Checks in-memory cache first (0ms) → then direct DB query if cache is cold.
 */
export async function getProductBySlug ( slug: string ): Promise<Product | undefined>
{
    // 1. If cache is warm, use it instantly (no network call)
    if ( _cachedProducts && ( Date.now() - _cacheTimestamp ) < CACHE_TTL_MS )
    {
        const cachedProduct = _cachedProducts.find( p => p.slug === slug );
        if ( cachedProduct ) return cachedProduct;
    }

    const supabase = getSupabase();
    if ( !supabase ) throw new Error( 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and a Supabase key.' );

    const { data, error } = await supabase
        .from( 'products' )
        .select( PRODUCT_SELECT )
        .eq( 'slug', slug )
        .eq( 'status', 'active' )
        .maybeSingle();

    if ( error )
    {
        console.error(
            `Failed to fetch Supabase product "${ slug }": ` +
            `code=${ error.code || 'unknown' }; message=${ error.message }; ` +
            `details=${ error.details || 'none' }; hint=${ error.hint || 'none' }`
        );
        throw new Error( `Could not load product from Supabase: ${ error.message }` );
    }

    return data ? formatSupabaseProduct( data ) : undefined;
}

export async function getProductSlugRedirect ( oldSlug: string ): Promise<string | undefined>
{
    const supabase = getSupabaseAdmin();
    if ( !supabase ) throw new Error( 'Supabase service role is required to resolve product URL redirects.' );

    const { data, error } = await supabase
        .from( 'product_slug_redirects' )
        .select( 'products!inner(slug)' )
        .eq( 'old_slug', oldSlug )
        .maybeSingle();

    if ( error )
    {
        if ( error.code === '42P01' || error.code === 'PGRST205' )
        {
            console.warn( 'Product slug redirects are unavailable until supabase/migrations/0005_product_slug_redirects.sql is applied.' );
            return undefined;
        }
        console.error( `Could not resolve product redirect "${ oldSlug }": ${ error.message }` );
        throw new Error( 'Could not resolve product URL redirect.' );
    }

    const product = Array.isArray( data?.products ) ? data.products[ 0 ] : data?.products;
    return product?.slug;
}

/** Admin version — always fresh (no cache), full data. */
export async function getAdminProducts (): Promise<Product[]>
{
    const supabase = getSupabase();
    if ( !supabase ) return [];

    const { data, error } = await supabase
        .from( 'products' )
        .select( '*, categories(name), product_variants(*), product_images(*)' );

    if ( error )
    {
        console.error( 'Failed to fetch admin products from Supabase:', error );
        throw new Error( 'Could not load products from Supabase.' );
    }

    return ( data || [] ).map( formatSupabaseProduct );
}

export async function getAdminProductById ( id: string ): Promise<Product | undefined>
{
    const supabase = getSupabase();
    if ( !supabase ) return undefined;

    const { data, error } = await supabase
        .from( 'products' )
        .select( '*, categories(name), product_variants(*), product_images(*)' )
        .eq( 'id', id )
        .maybeSingle();

    if ( error )
    {
        console.error( 'Failed to fetch admin product:', error );
        throw new Error( 'Could not load product for editing.' );
    }

    return data ? formatSupabaseProduct( data ) : undefined;
}
