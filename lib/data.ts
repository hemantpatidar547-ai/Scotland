import clientPromise from '@/lib/mongodb';
import { Product } from '@/types/product';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Singleton Supabase clients ──────────────────────────────────────────────
let _supabaseAdmin: SupabaseClient | null = null;
let _supabaseAnon: SupabaseClient | null = null;

function getSupabaseAdmin (): SupabaseClient | null
{
    if ( _supabaseAdmin ) return _supabaseAdmin;
    if ( process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY )
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
    if ( process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY )
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
    const image = productImages.find( ( i: any ) => i.is_primary )?.image_url
        || productImages[ 0 ]?.image_url
        || variant?.image_url
        || '/images/brand/scotland-lion.png'; return {
            id: product.id,
            slug: product.slug,
            sku: product.sku,
            name: product.name,
            description: product.description,
            shortDescription: product.short_description || product.description,
            category: metadata.category || product.categories?.name || 'Clothing',
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
            cost_price: product.cost_price ? Number( product.cost_price ) : undefined,
            gst: product.tax_percentage ? `${ Number( product.tax_percentage ) }%` : '0%',
            stock: variants.reduce( ( total: number, v: any ) => total + ( Number( v.stock_quantity ) || 0 ), 0 ),
            sizeStock,
            inventoryVariants: variants.map( ( v: any ) => ( {
                id: v.id,
                color: v.color || 'Default',
                size: v.size || 'One size',
                stockQuantity: Number( v.stock_quantity ) || 0,
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
    const supabase = getSupabase();

    if ( supabase )
    {
        const { data, error } = await supabase
            .from( 'products' )
            .select( '*, product_variants(*), product_images(*)' );

        if ( !error && data?.length )
        {
            return data.map( formatSupabaseProduct );
        }
    }

    if ( !clientPromise ) return [];

    try
    {
        const client = await clientPromise;
        const mongoProducts = await client.db( 'scotland' ).collection( 'products' ).find( {} ).toArray();

        return mongoProducts.map( p => ( {
            id: p._id.toString(),
            slug: p.slug,
            name: p.name,
            description: p.description,
            shortDescription: p.shortDescription || p.description,
            category: p.category || 'Clothing',
            gender: p.gender || 'Unisex',
            rating: Number( p.rating || 0 ),
            reviews: Number( p.reviews || 0 ),
            image: p.image || '/images/brand/scotland-lion.png',
            images: Array.isArray( p.images ) && p.images.length > 0 ? p.images : [ p.image || '/images/brand/scotland-lion.png' ],
            colors: Array.isArray( p.colors ) && p.colors.length > 0 ? p.colors : [ 'Default' ],
            sizes: Array.isArray( p.sizes ) && p.sizes.length > 0 ? p.sizes : [ 'One size' ],
            mrp: p.mrp ? Number( p.mrp ) : undefined,
            salePrice: p.salePrice ? Number( p.salePrice ) : undefined,
            discount: p.discount ? Number( p.discount ) : undefined,
            material: p.material || 'Not specified',
            stock: Number( p.stock ?? p.stock_quantity ?? 0 ),
            styleOrigin: p.styleOrigin || 'Scotland',
            occasion: p.occasion || 'Everyday',
            isNew: p.isNew ?? false,
            price: Number( p.price ),
        } ) );
    }
    catch ( err )
    {
        console.error( 'Error fetching MongoDB products:', err );
        return [];
    }
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

    const products = await fetchAllProductsFromDB();
    _cachedProducts = products;
    _cacheTimestamp = Date.now();
    return products;
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
        return _cachedProducts.find( p => p.slug === slug );
    }

    // 2. Cache is cold — fetch all (warms the cache for subsequent requests too)
    const all = await getAllProducts();
    return all.find( p => p.slug === slug );
}

/** Admin version — always fresh (no cache), full data. */
export async function getAdminProducts (): Promise<Product[]>
{
    const supabase = getSupabase();
    if ( !supabase ) return [];

    const { data, error } = await supabase
        .from( 'products' )
        .select( '*, categories(name), product_variants(*), product_images(*)' );

    return !error && data ? data.map( formatSupabaseProduct ) : [];
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
