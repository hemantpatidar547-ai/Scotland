import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { getAdminProductSchemaError } from '@/lib/admin-product-schema';
import { bustProductCache } from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isPublicHttpUrl } from '@/lib/seo';

export async function PATCH ( request: Request, props: { params: Promise<{ id: string }> } )
{
    if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    const params = await props.params;
    if ( !supabaseAdmin ) return NextResponse.json( { error: 'Supabase is not configured' }, { status: 503 } );

    const body = await request.json();
    const { status } = body;

    const dbStatus = status === 'published' ? 'active' : 'draft';

    const { error } = await supabaseAdmin
        .from( 'products' )
        .update( { status: dbStatus } )
        .eq( 'id', params.id );

    if ( error ) return NextResponse.json( { error: error.message }, { status: 400 } );

    bustProductCache(); // clear in-memory cache so next request is fresh
    return NextResponse.json( { success: true } );
}

export async function PUT ( request: Request, props: { params: Promise<{ id: string }> } )
{
    if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    const { id } = await props.params;
    if ( !supabaseAdmin ) return NextResponse.json( { error: 'Supabase is not configured' }, { status: 503 } );

    const payload = await request.json();
    if ( !payload.name?.trim() || !payload.sku?.trim() || !payload.description?.trim() )
    {
        return NextResponse.json( { error: 'Name, SKU, and description are required.' }, { status: 400 } );
    }
    if ( payload.canonical_url?.trim() && !isPublicHttpUrl( String( payload.canonical_url ).trim() ) )
        return NextResponse.json( { error: 'Canonical URL must be a valid public HTTP or HTTPS URL.' }, { status: 400 } );
    if (
        !Array.isArray( payload.colors ) || !payload.colors.length ||
        !Array.isArray( payload.sizes ) || !payload.sizes.length ||
        payload.colors.some( ( color: unknown ) => typeof color !== 'string' || !color.trim() ) ||
        payload.sizes.some( ( size: unknown ) => typeof size !== 'string' || !size.trim() )
    )
    {
        return NextResponse.json( { error: 'Select at least one size and one color.' }, { status: 400 } );
    }
    if ( !payload.variantStock || typeof payload.variantStock !== 'object' || Array.isArray( payload.variantStock ) )
        return NextResponse.json( { error: 'Variant stock quantities are required.' }, { status: 400 } );
    if ( !Array.isArray( payload.images ) || !payload.images.length )
    {
        return NextResponse.json( { error: 'A main product image is required.' }, { status: 400 } );
    }

    const normalizedSku = String( payload.sku ).trim().toUpperCase();
    const normalizedSlug = String( payload.slug || payload.name )
        .trim()
        .toLowerCase()
        .normalize( 'NFKD' )
        .replace( /[\u0300-\u036f]/g, '' )
        .replace( /[^a-z0-9]+/g, '-' )
        .replace( /(^-|-$)/g, '' );

    const { data: currentProduct, error: productFetchError } = await supabaseAdmin
        .from( 'products' )
        .select( 'id, sku, product_metadata' )
        .eq( 'id', id )
        .maybeSingle();
    if ( productFetchError )
    {
        const schemaMessage = getAdminProductSchemaError( productFetchError );
        return NextResponse.json( { error: schemaMessage || productFetchError.message }, { status: schemaMessage ? 503 : 500 } );
    }
    if ( !currentProduct ) return NextResponse.json( { error: 'Product not found.' }, { status: 404 } );

    if ( String( currentProduct.sku || '' ).trim().toUpperCase() !== normalizedSku )
    {
        const { data: duplicateSku, error: skuError } = await supabaseAdmin
            .from( 'products' )
            .select( 'id' )
            .eq( 'sku', normalizedSku )
            .neq( 'id', id )
            .maybeSingle();
        if ( skuError ) return NextResponse.json( { error: 'Could not validate SKU.' }, { status: 503 } );
        if ( duplicateSku ) return NextResponse.json( { error: `SKU ${ normalizedSku } already belongs to another product.` }, { status: 409 } );
    }

    const { data: duplicateSlug, error: slugError } = await supabaseAdmin
        .from( 'products' )
        .select( 'id' )
        .eq( 'slug', normalizedSlug )
        .neq( 'id', id )
        .maybeSingle();
    if ( slugError ) return NextResponse.json( { error: 'Could not validate product URL.' }, { status: 503 } );
    if ( duplicateSlug ) return NextResponse.json( { error: 'A product with this URL already belongs to another product.' }, { status: 409 } );

    let categoryId: string | null = null;
    if ( payload.category?.trim() )
    {
        const categoryName = String( payload.category ).trim();
        const categorySlug = categoryName.toLowerCase().replace( /[^a-z0-9]+/g, '-' ).replace( /(^-|-$)/g, '' );
        const { data: categoryByName, error: categoryNameError } = await supabaseAdmin
            .from( 'categories' )
            .select( 'id' )
            .eq( 'name', categoryName )
            .maybeSingle();
        if ( categoryNameError ) return NextResponse.json( { error: categoryNameError.message }, { status: 400 } );

        if ( categoryByName )
        {
            categoryId = categoryByName.id;
        } else
        {
            const { data: categoryBySlug, error: categorySlugError } = await supabaseAdmin
                .from( 'categories' )
                .select( 'id' )
                .eq( 'slug', categorySlug )
                .maybeSingle();
            if ( categorySlugError ) return NextResponse.json( { error: categorySlugError.message }, { status: 400 } );
            if ( categoryBySlug )
            {
                categoryId = categoryBySlug.id;
            } else
            {
                const { data: createdCategory, error: createCategoryError } = await supabaseAdmin
                    .from( 'categories' )
                    .insert( { name: categoryName, slug: categorySlug, is_active: true } )
                    .select( 'id' )
                    .single();
                if ( createCategoryError || !createdCategory )
                    return NextResponse.json( { error: createCategoryError?.message || 'Could not save category.' }, { status: 400 } );
                categoryId = createdCategory.id;
            }
        }
    }

    const metadata = {
        ...( currentProduct.product_metadata || {} ),
        category: payload.category,
        subcategory: payload.subcategory,
        fabric: payload.fabric,
        fit: payload.fit,
        pattern: payload.pattern,
        sleeve: payload.sleeve,
        collar: payload.collar,
        weight: payload.weight,
        dimensions: payload.dimensions,
        cod: payload.cod,
        low_stock_alert: payload.low_stock_alert,
        stock_status: payload.stock_status,
        size_chart: payload.size_chart,
        seo_title: payload.seo_title,
        meta_description: payload.meta_description,
        focus_keyword: payload.focus_keyword,
        canonical_url: payload.canonical_url?.trim() || null,
        no_index: Boolean( payload.no_index ),
        image_alt_text: payload.image_alt_text?.trim(),
        gtin: payload.gtin?.trim() || null,
        mpn: payload.mpn?.trim() || null,
        tags: payload.tags,
    };

    const { data: existingVariants, error: variantFetchError } = await supabaseAdmin
        .from( 'product_variants' )
        .select( 'id, sku, color, size, stock_quantity, reserved_quantity, is_active' )
        .eq( 'product_id', id );
    if ( variantFetchError ) return NextResponse.json( { error: variantFetchError.message }, { status: 400 } );

    const stockByCombination = payload.variantStock || {};
    const desiredVariants: Array<{ color: string; size: string; stockQuantity: number }> = payload.colors.flatMap( ( color: string ) => payload.sizes.map( ( size: string ) => ( {
        color,
        size,
        stockQuantity: Number( stockByCombination[ JSON.stringify( [ color, size ] ) ] ),
    } ) ) );
    const invalidVariant = desiredVariants.find( variant => !Number.isInteger( variant.stockQuantity ) || variant.stockQuantity < 0 );
    if ( invalidVariant )
        return NextResponse.json( { error: `Enter a valid whole-number stock for ${ invalidVariant.color } / ${ invalidVariant.size }.` }, { status: 400 } );
    const existingByCombination = new Map(
        ( existingVariants || [] ).map( variant => [ JSON.stringify( [ variant.color || 'Default', variant.size || 'One size' ] ), variant ] )
    );
    const desiredKeys = new Set( desiredVariants.map( variant => JSON.stringify( [ variant.color, variant.size ] ) ) );
    const removedVariants = ( existingVariants || [] ).filter( variant =>
        !desiredKeys.has( JSON.stringify( [ variant.color || 'Default', variant.size || 'One size' ] ) )
    );

    if ( removedVariants.some( variant => variant.is_active && Number( variant.reserved_quantity ) > 0 ) )
    {
        return NextResponse.json( { error: 'A size/color with reserved orders cannot be removed.' }, { status: 409 } );
    }
    for ( const variant of desiredVariants )
    {
        const existing = existingByCombination.get( JSON.stringify( [ variant.color, variant.size ] ) );
        if ( existing && variant.stockQuantity < Number( existing.reserved_quantity ) )
            return NextResponse.json( { error: `Stock for ${ variant.color } / ${ variant.size } cannot be lower than units reserved for orders.` }, { status: 409 } );
    }

    const skuChanged = String( currentProduct.sku || '' ).trim().toUpperCase() !== normalizedSku;
    const { error: productUpdateError } = await supabaseAdmin
        .from( 'products' )
        .update( {
            name: String( payload.name ).trim(),
            slug: normalizedSlug,
            brand_name: String( payload.brand_name || 'SCOTLAND' ).trim(),
            ...( skuChanged ? { sku: normalizedSku } : {} ),
            description: String( payload.description ).trim(),
            short_description: payload.short_description || payload.description,
            category_id: categoryId,
            gender: [ 'Men', 'Women', 'Unisex' ].includes( payload.gender ) ? payload.gender : 'Unisex',
            style_origin: payload.styleOrigin || undefined,
            occasion: payload.occasion || null,
            season: payload.season || null,
            material: payload.material || null,
            price: Number( payload.price ),
            sale_price: Number( payload.salePrice || payload.price ),
            cost_price: payload.cost_price === null ? null : Number( payload.cost_price || 0 ) || null,
            mrp: Number( payload.mrp ) || null,
            discount: Number( payload.discount ) || 0,
            tax_percentage: Number.parseFloat( String( payload.gst || '0' ) ) || 0,
            product_metadata: metadata,
            status: payload.status === 'published' ? 'active' : 'draft',
            is_featured: Boolean( payload.featured ),
            is_new_arrival: Boolean( payload.isNew ),
            is_best_seller: Boolean( payload.best_seller ),
            is_on_sale: Boolean( payload.mrp && payload.salePrice && Number( payload.salePrice ) < Number( payload.mrp ) ),
            updated_at: new Date().toISOString(),
        } )
        .eq( 'id', id );
    if ( productUpdateError )
    {
        const schemaMessage = getAdminProductSchemaError( productUpdateError );
        const duplicateSkuMessage = productUpdateError.code === '23505' && productUpdateError.message.includes( 'products_sku_key' )
            ? `SKU ${ normalizedSku } already belongs to another product. Keep this product's current SKU or enter a unique one.`
            : null;
        return NextResponse.json(
            { error: schemaMessage || duplicateSkuMessage || productUpdateError.message },
            { status: schemaMessage ? 503 : duplicateSkuMessage ? 409 : 400 }
        );
    }

    if ( removedVariants.length )
    {
        const { error } = await supabaseAdmin.from( 'product_variants' )
            .update( { is_active: false, updated_at: new Date().toISOString() } )
            .in( 'id', removedVariants.map( variant => variant.id ) );
        if ( error ) return NextResponse.json( { error: error.message }, { status: 400 } );
    }

    const variantsToInsert = [];
    for ( const variant of desiredVariants )
    {
        const existing = existingByCombination.get( JSON.stringify( [ variant.color, variant.size ] ) );
        if ( existing )
        {
            const { error } = await supabaseAdmin
                .from( 'product_variants' )
                .update( {
                    color: variant.color,
                    size: variant.size,
                    is_active: true,
                    price: Number( payload.price ) || 0,
                    sale_price: Number( payload.salePrice || payload.price ) || null,
                    stock_quantity: variant.stockQuantity,
                    updated_at: new Date().toISOString(),
                } )
                .eq( 'id', existing.id );
            if ( error ) return NextResponse.json( { error: error.message }, { status: 400 } );
        } else
        {
            variantsToInsert.push( {
                product_id: id,
                sku: `${ normalizedSku }-${ variant.color }-${ variant.size }`.replace( /[^a-zA-Z0-9-]/g, '-' ),
                color: variant.color,
                size: variant.size,
                price: Number( payload.price ) || 0,
                sale_price: Number( payload.salePrice || payload.price ) || null,
                stock_quantity: variant.stockQuantity,
            } );
        }
    }

    if ( variantsToInsert.length )
    {
        const { error } = await supabaseAdmin.from( 'product_variants' ).insert( variantsToInsert );
        if ( error ) return NextResponse.json( { error: error.message }, { status: 400 } );
    }

    const imageUrls = Array.from( new Set( [ payload.image, ...payload.images ].filter( ( image ): image is string => typeof image === 'string' && image.length > 0 ) ) );
    const { error: imageDeleteError } = await supabaseAdmin.from( 'product_images' ).delete().eq( 'product_id', id );
    if ( imageDeleteError ) return NextResponse.json( { error: imageDeleteError.message }, { status: 400 } );

    const { error: imageInsertError } = await supabaseAdmin.from( 'product_images' ).insert(
        imageUrls.map( ( image_url, index ) => ( {
            product_id: id,
            image_url,
            alt_text: image_url === payload.image
                ? String( payload.image_alt_text || payload.name ).trim()
                : `${ String( payload.name ).trim() } - product view ${ index + 1 }`,
            display_order: index,
            is_primary: image_url === payload.image || index === 0,
        } ) )
    );
    if ( imageInsertError ) return NextResponse.json( { error: imageInsertError.message }, { status: 400 } );

    bustProductCache();
    return NextResponse.json( { success: true } );
}

export async function DELETE ( request: Request, props: { params: Promise<{ id: string }> } )
{
    if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    const params = await props.params;
    if ( !supabaseAdmin ) return NextResponse.json( { error: 'Supabase is not configured' }, { status: 503 } );

    await supabaseAdmin.from( 'product_images' ).delete().eq( 'product_id', params.id );
    await supabaseAdmin.from( 'product_variants' ).delete().eq( 'product_id', params.id );

    const { error } = await supabaseAdmin
        .from( 'products' )
        .delete()
        .eq( 'id', params.id );

    if ( error ) return NextResponse.json( { error: error.message }, { status: 400 } );

    bustProductCache(); // clear in-memory cache after deletion
    return NextResponse.json( { success: true } );
}
