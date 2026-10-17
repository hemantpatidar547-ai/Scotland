import { NextResponse } from 'next/server';
import { getAdminProductSchemaError } from '@/lib/admin-product-schema';
import { bustProductCache } from '@/lib/data';
import { isAdminRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isPublicHttpUrl } from '@/lib/seo';

type ProductPayload = {
    name?: string;
    slug?: string;
    sku?: string;
    brand_name?: string;
    description?: string;
    short_description?: string;
    category?: string;
    subcategory?: string;
    gender?: string;
    styleOrigin?: string;
    occasion?: string;
    season?: string;
    material?: string;
    mrp?: number;
    price?: number;
    salePrice?: number;
    cost_price?: number | null;
    discount?: number;
    gst?: string;
    sizes?: string[];
    colors?: string[];
    sizeStock?: Record<string, number>;
    variantStock?: Record<string, number>;
    stock_quantity?: number;
    low_stock_alert?: number;
    stock_status?: string;
    image?: string;
    images?: string[];
    size_chart?: string | null;
    fabric?: string;
    fit?: string;
    pattern?: string;
    sleeve?: string;
    collar?: string;
    weight?: string;
    dimensions?: string;
    cod?: boolean;
    seo_title?: string;
    meta_description?: string;
    focus_keyword?: string;
    canonical_url?: string;
    no_index?: boolean;
    image_alt_text?: string;
    gtin?: string;
    mpn?: string;
    tags?: string[];
    status?: 'draft' | 'published';
    featured?: boolean;
    isNew?: boolean;
    best_seller?: boolean;
};

export async function POST ( request: Request )
{
    if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    if ( !supabaseAdmin )
    {
        return NextResponse.json(
            { error: 'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' },
            { status: 503 }
        );
    }

    const payload = await request.json() as ProductPayload;
    if ( !payload.name || !payload.slug || !payload.sku || !payload.description )
    {
        return NextResponse.json( { error: 'Name, slug, SKU, and description are required.' }, { status: 400 } );
    }
    if ( payload.canonical_url?.trim() && !isPublicHttpUrl( payload.canonical_url.trim() ) )
        return NextResponse.json( { error: 'Canonical URL must be a valid public HTTP or HTTPS URL.' }, { status: 400 } );

    const normalizedSku = payload.sku.trim().toUpperCase();
    const { data: existingSku, error: skuLookupError } = await supabaseAdmin
        .from( 'products' )
        .select( 'id' )
        .eq( 'sku', normalizedSku )
        .maybeSingle();

    if ( skuLookupError )
    {
        return NextResponse.json( { error: 'Could not validate SKU. Please try again.' }, { status: 503 } );
    }

    if ( existingSku )
    {
        return NextResponse.json( { error: `SKU ${ normalizedSku } already exists. Use a unique SKU.` }, { status: 409 } );
    }

    const baseSlug = ( payload.slug || payload.name )
        .trim()
        .toLowerCase()
        .normalize( 'NFKD' )
        .replace( /[\u0300-\u036f]/g, '' )
        .replace( /[^a-z0-9]+/g, '-' )
        .replace( /(^-|-$)/g, '' );
    let uniqueSlug = baseSlug;
    const { data: existingSlug, error: slugLookupError } = await supabaseAdmin
        .from( 'products' )
        .select( 'id' )
        .eq( 'slug', uniqueSlug )
        .maybeSingle();

    if ( slugLookupError )
    {
        return NextResponse.json( { error: 'Could not validate product URL. Please try again.' }, { status: 503 } );
    }

    if ( existingSlug )
    {
        uniqueSlug = `${ baseSlug }-${ normalizedSku.toLowerCase().replace( /[^a-z0-9]+/g, '-' ) }`;
        const { data: duplicateSlug } = await supabaseAdmin.from( 'products' ).select( 'id' ).eq( 'slug', uniqueSlug ).maybeSingle();
        if ( duplicateSlug )
        {
            return NextResponse.json( { error: `A product with this name and SKU already exists. Use a different SKU.` }, { status: 409 } );
        }
    }

    let categoryId: string | null = null;
    if ( payload.category?.trim() )
    {
        const categoryName = payload.category.trim();
        const categorySlug = categoryName.toLowerCase().replace( /[^a-z0-9]+/g, '-' ).replace( /(^-|-$)/g, '' );
        const { data: existingCategoryByName, error: categoryNameLookupError } = await supabaseAdmin
            .from( 'categories' )
            .select( 'id' )
            .eq( 'name', categoryName )
            .maybeSingle();

        if ( categoryNameLookupError )
        {
            return NextResponse.json( { error: 'Could not validate category. Please try again.' }, { status: 503 } );
        }

        if ( existingCategoryByName )
        {
            categoryId = existingCategoryByName.id;
        }
        else
        {
            const { data: existingCategoryBySlug, error: categorySlugLookupError } = await supabaseAdmin
                .from( 'categories' )
                .select( 'id' )
                .eq( 'slug', categorySlug )
                .maybeSingle();
            if ( categorySlugLookupError )
                return NextResponse.json( { error: 'Could not validate category URL. Please try again.' }, { status: 503 } );

            if ( existingCategoryBySlug )
            {
                categoryId = existingCategoryBySlug.id;
            } else
            {
                const { data: createdCategory, error: categoryCreateError } = await supabaseAdmin
                .from( 'categories' )
                .insert( { name: categoryName, slug: categorySlug, is_active: true } )
                .select( 'id' )
                .single();

                if ( categoryCreateError || !createdCategory )
                {
                    return NextResponse.json( { error: categoryCreateError?.message || 'Could not create category.' }, { status: 400 } );
                }
                categoryId = createdCategory.id;
            }
        }
    }

    const colors = payload.colors?.length ? payload.colors : [ 'Default' ];
    const sizes = payload.sizes?.length ? payload.sizes : [ 'One size' ];
    const variantStock = colors.flatMap( color => sizes.map( size => ( {
        color,
        size,
        stockQuantity: Number( payload.variantStock?.[ JSON.stringify( [ color, size ] ) ] ?? payload.sizeStock?.[ size ] ?? 0 ),
    } ) ) );
    const invalidVariantStock = variantStock.find( variant => !Number.isInteger( variant.stockQuantity ) || variant.stockQuantity < 0 );
    if ( invalidVariantStock )
    {
        return NextResponse.json( { error: `Enter a valid whole-number stock for ${ invalidVariantStock.color } / ${ invalidVariantStock.size }.` }, { status: 400 } );
    }

    const productInsert = {
        name: payload.name,
        slug: uniqueSlug,
        description: payload.description,
        short_description: payload.short_description || payload.description,
        category_id: categoryId,
        brand_name: payload.brand_name?.trim() || 'SCOTLAND',
        gender: payload.gender === 'Men' || payload.gender === 'Women' ? payload.gender : 'Unisex',
        style_origin: payload.styleOrigin,
        occasion: payload.occasion,
        season: payload.season,
        material: payload.material,
        price: payload.price || 0,
        sale_price: payload.salePrice || payload.price || null,
        cost_price: payload.cost_price || null,
        mrp: payload.mrp || null,
        discount: payload.discount || 0,
        tax_percentage: Number.parseFloat( payload.gst || '0' ) || 0,
        product_metadata: {
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
        },
        sku: normalizedSku,
        status: payload.status === 'published' ? 'active' : 'draft',
        is_featured: Boolean( payload.featured ),
        is_new_arrival: Boolean( payload.isNew ),
        is_best_seller: Boolean( payload.best_seller ),
        is_on_sale: Boolean( payload.mrp && payload.salePrice && payload.salePrice < payload.mrp ),
    };

    const { data: product, error: productError } = await supabaseAdmin
        .from( 'products' )
        .insert( productInsert )
        .select( 'id' )
        .single();

    if ( productError || !product )
    {
        const schemaMessage = getAdminProductSchemaError( productError );
        return NextResponse.json(
            { error: schemaMessage || productError?.message || 'Could not save product.' },
            { status: schemaMessage ? 503 : 400 }
        );
    }

    const variants = variantStock.map( variant => ( {
            product_id: product.id,
            sku: `${ payload.sku }-${ variant.color }-${ variant.size }`.replace( /[^a-zA-Z0-9-]/g, '-' ),
            color: variant.color,
            size: variant.size,
            price: payload.price || 0,
            sale_price: payload.salePrice || payload.price || null,
            stock_quantity: variant.stockQuantity,
        } ) );

    const { error: variantsError } = await supabaseAdmin.from( 'product_variants' ).insert( variants );
    if ( variantsError )
    {
        await supabaseAdmin.from( 'products' ).delete().eq( 'id', product.id );
        return NextResponse.json( { error: variantsError.message }, { status: 400 } );
    }

    const imageUrls = [ ...( payload.image ? [ payload.image ] : [] ), ...( payload.images || [] ).filter( image => image !== payload.image ) ];
    if ( imageUrls.length )
    {
        const { error: imagesError } = await supabaseAdmin.from( 'product_images' ).insert(
            imageUrls.map( ( image_url, index ) => ( {
                product_id: product.id,
                image_url,
                alt_text: index === 0
                    ? payload.image_alt_text?.trim() || payload.name
                    : `${ payload.name } - product view ${ index + 1 }`,
                display_order: index,
                is_primary: index === 0,
            } ) )
        );
        if ( imagesError )
        {
            await supabaseAdmin.from( 'products' ).delete().eq( 'id', product.id );
            return NextResponse.json( { error: imagesError.message }, { status: 400 } );
        }
    }

    bustProductCache();
    return NextResponse.json( { data: { id: product.id }, message: 'Product saved to Supabase.' }, { status: 201 } );
}

export async function GET ()
{
    if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    if ( !supabaseAdmin ) return NextResponse.json( { error: 'Supabase is not configured' }, { status: 503 } );

    const { data, error } = await supabaseAdmin
        .from( 'product_variants' )
        .select( 'id, product_id, color, size, stock_quantity' )
        .eq( 'is_active', true );

    if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );

    return NextResponse.json( {
        variants: ( data || [] ).map( variant => ( {
            id: variant.id,
            productId: variant.product_id,
            color: variant.color || 'Default',
            size: variant.size || 'One size',
            stockQuantity: Number( variant.stock_quantity ) || 0,
        } ) ),
    } );
}
