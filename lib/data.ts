import clientPromise from '@/lib/mongodb';
import { Product } from '@/types/product';
import { createClient } from '@supabase/supabase-js';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ? createClient( process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY )
    : null;

function formatSupabaseProduct ( product: any ): Product
{
    const variant = product.product_variants?.[ 0 ];
    const metadata = product.product_metadata || {};
    const variants = product.product_variants || [];
    const colors = Array.from( new Set<string>( variants.map( ( item: any ) => item.color ).filter( ( value: any ): value is string => Boolean( value ) ) ) );
    const sizes = Array.from( new Set<string>( variants.map( ( item: any ) => item.size ).filter( ( value: any ): value is string => Boolean( value ) ) ) );
    const image = product.product_images?.find( ( item: any ) => item.is_primary )?.image_url
        || product.product_images?.[ 0 ]?.image_url
        || variant?.image_url
        || '/images/brand/scotland-lion.png';

    return {
        id: product.id,
        slug: product.slug,
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
        images: [ image ],
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
        stock: Number( variant?.stock_quantity || 0 ),
        styleOrigin: product.style_origin || 'Scotland',
        occasion: product.occasion || 'Everyday',
        isNew: product.is_new_arrival,
        isBestSeller: product.is_best_seller,
        status: product.status === 'active' || product.status === 'published' ? 'published' : 'draft',
    };
}

export async function getAllProducts ()
{
    const supabaseServer = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createClient( process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY )
        : supabase;

    if ( supabaseServer )
    {
        const { data: supabaseProducts, error } = await supabaseServer
            .from( 'products' )
            .select( '*, product_variants(*), product_images(*)' );

        if ( !error && supabaseProducts?.length )
        {
            return supabaseProducts.map( formatSupabaseProduct );
        }
    }

    if ( !clientPromise )
    {
        return [];
    }

    try
    {
        const client = await clientPromise;
        const db = client.db( 'scotland' );
        const mongoProducts = await db.collection( 'products' ).find( {} ).toArray();

        if ( mongoProducts.length === 0 )
        {
            return [];
        }

        const formattedMongoProducts: Product[] = mongoProducts.map( p => ( {
            id: p._id.toString(),
            slug: p.slug,
            name: p.name,
            description: p.description,
            category: p.category || 'Clothing',
            shortDescription: p.shortDescription || p.description,
            gender: p.gender || 'Unisex',
            rating: Number( p.rating || 0 ),
            reviews: Number( p.reviews || 0 ),
            image: p.image || '/images/brand/scotland-lion.png',
            images: Array.isArray( p.images ) && p.images.length > 0 ? p.images : [ p.image || '/images/brand/scotland-lion.png' ],
            colors: Array.isArray( p.colors ) && p.colors.length > 0 ? p.colors : [ 'Default' ],
            sizes: Array.isArray( p.sizes ) && p.sizes.length > 0 ? p.sizes : [ 'One size' ],
            mrp: p.mrp ? Number( p.mrp ) : ( p.product_metadata?.mrp ? Number( p.product_metadata.mrp ) : undefined ),
            salePrice: p.salePrice ? Number( p.salePrice ) : undefined,
            discount: p.discount ? Number( p.discount ) : undefined,
            material: p.material || 'Not specified',
            stock: Number( p.stock ?? p.stock_quantity ?? 0 ),
            styleOrigin: p.styleOrigin || 'Scotland',
            occasion: p.occasion || 'Everyday',
            isNew: p.isNew ?? false,
            price: Number( p.price )
        } ) );

        return formattedMongoProducts;
    } catch ( error )
    {
        console.error( "Error fetching MongoDB products:", error );
        return [];
    }
}

export async function getAdminProducts ()
{
    const supabaseServer = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createClient( process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY )
        : supabase;

    if ( !supabaseServer ) return [];

    const { data: supabaseProducts, error } = await supabaseServer
        .from( 'products' )
        .select( '*, categories(name), product_variants(*), product_images(*)' );

    return !error && supabaseProducts ? supabaseProducts.map( formatSupabaseProduct ) : [];
}

export async function getProductBySlug ( slug: string )
{
    const all = await getAllProducts();
    return all.find( p => p.slug === slug );
}
