import { supabaseAdmin } from '@/lib/supabase/server';

type CreateProductInput = {
    name: string;
    slug: string;
    description: string;
    sku: string;
    price: number;
    category?: string;
    stock_quantity: number;
    image?: string | null;
};

export async function createProduct ( input: CreateProductInput )
{
    if ( !supabaseAdmin )
    {
        return { error: 'Supabase server key is missing. Add SUPABASE_SERVICE_ROLE_KEY to .env.local.', status: 503 } as const;
    }

    const { data: category } = input.category
        ? await supabaseAdmin.from( 'categories' ).select( 'id' ).eq( 'name', input.category ).maybeSingle()
        : { data: null };

    let productSku = input.sku.trim();
    const { data: existingProductSku } = await supabaseAdmin.from( 'products' ).select( 'id' ).eq( 'sku', productSku ).maybeSingle();
    const { data: existingVariantSku } = await supabaseAdmin.from( 'product_variants' ).select( 'id' ).eq( 'sku', productSku ).maybeSingle();

    if ( existingProductSku || existingVariantSku )
    {
        productSku = `${ productSku }-${ Date.now() }`;
    }

    let productSlug = input.slug;
    const { data: existingSlug } = await supabaseAdmin.from( 'products' ).select( 'id' ).eq( 'slug', productSlug ).maybeSingle();

    if ( existingSlug )
    {
        const skuSlug = productSku.toLowerCase().replace( /[^a-z0-9]+/g, '-' ).replace( /(^-|-$)/g, '' );
        productSlug = `${ productSlug }-${ skuSlug }`;
    }

    const { data: stillExisting } = await supabaseAdmin.from( 'products' ).select( 'id' ).eq( 'slug', productSlug ).maybeSingle();
    if ( stillExisting ) productSlug = `${ productSlug }-${ Date.now() }`;

    const { data: product, error: productError } = await supabaseAdmin
        .from( 'products' )
        .insert( {
            name: input.name,
            slug: productSlug,
            description: input.description,
            short_description: input.description,
            category_id: category?.id || null,
            price: input.price,
            sku: productSku,
            status: 'active',
            is_new_arrival: true
        } )
        .select( 'id' )
        .single();

    if ( productError || !product )
    {
        const message = productError?.code === 'PGRST205'
            ? 'Supabase products table is missing. Run the ecommerce migration in Supabase SQL Editor.'
            : productError?.message || 'Product could not be saved.';
        return { error: message, status: productError?.code === 'PGRST205' ? 503 : 400 } as const;
    }

    const { error: variantError } = await supabaseAdmin.from( 'product_variants' ).insert( {
        product_id: product.id,
        sku: productSku,
        stock_quantity: input.stock_quantity,
        image_url: input.image || null
    } );

    if ( variantError )
    {
        await supabaseAdmin.from( 'products' ).delete().eq( 'id', product.id );
        return { error: variantError.message, status: 400 } as const;
    }

    if ( input.image )
    {
        const { error: imageError } = await supabaseAdmin.from( 'product_images' ).insert( {
            product_id: product.id,
            image_url: input.image,
            alt_text: input.name,
            is_primary: true
        } );

        if ( imageError )
        {
            await supabaseAdmin.from( 'products' ).delete().eq( 'id', product.id );
            return { error: imageError.message, status: 400 } as const;
        }
    }

    return { data: { id: product.id }, status: 201 } as const;
}
