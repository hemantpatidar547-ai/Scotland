import clientPromise from '@/lib/mongodb';
import { products as staticProducts } from '@/lib/products';
import { Product } from '@/types/product';
import { createClient } from '@supabase/supabase-js';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ? createClient( process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY )
    : null;

function formatSupabaseProduct ( product: any ): Product
{
    const variant = product.product_variants?.[ 0 ];
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
        category: 'Clothing',
        gender: product.gender || 'Unisex',
        price: Number( product.price ),
        rating: Number( product.average_rating || 0 ),
        reviews: Number( product.review_count || 0 ),
        image,
        images: [ image ],
        colors: [ variant?.color || 'Default' ],
        sizes: [ variant?.size || 'One size' ],
        material: product.material || 'Not specified',
        stock: Number( variant?.stock_quantity || 0 ),
        styleOrigin: product.style_origin || 'Scotland',
        occasion: product.occasion || 'Everyday',
        isNew: product.is_new_arrival,
        isBestSeller: product.is_best_seller
    };
}

export async function getAllProducts ()
{
    if ( supabase )
    {
        const { data: supabaseProducts, error } = await supabase
            .from( 'products' )
            .select( '*, product_variants(*), product_images(*)' )
            .eq( 'status', 'active' );

        if ( !error && supabaseProducts )
        {
            return [ ...supabaseProducts.map( formatSupabaseProduct ), ...staticProducts ];
        }
    }

    if ( !clientPromise )
    {
        return staticProducts;
    }

    try
    {
        const client = await clientPromise;
        const db = client.db( 'scotland' );
        const mongoProducts = await db.collection( 'products' ).find( {} ).toArray();

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
            material: p.material || 'Not specified',
            stock: Number( p.stock ?? p.stock_quantity ?? 0 ),
            styleOrigin: p.styleOrigin || 'Scotland',
            occasion: p.occasion || 'Everyday',
            isNew: true,
            price: Number( p.price )
        } ) );

        // Combine MongoDB products with static catalog (Mongo products first)
        return [ ...formattedMongoProducts, ...staticProducts ];
    } catch ( error )
    {
        console.error( "Error fetching MongoDB products:", error );
        return staticProducts;
    }
}

export async function getProductBySlug ( slug: string )
{
    const all = await getAllProducts();
    return all.find( p => p.slug === slug );
}
