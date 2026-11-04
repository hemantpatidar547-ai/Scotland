import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { isBuyThreeTshirtProduct } from '@/lib/buy-3-get-tshirt';

export const dynamic = 'force-dynamic';

type TshirtProductRecord = {
    id: string;
    name: string;
    categories: { name: string } | { name: string }[] | null;
    product_images: Array<{
        image_url: string;
        display_order: number | null;
        is_primary: boolean;
    }>;
    product_variants: Array<{
        id: string;
        color: string | null;
        size: string | null;
        stock_quantity: number;
        reserved_quantity: number;
        is_active: boolean;
    }>;
};

export async function GET ()
{
    try
    {
        const db = getSupabaseAdmin();
        const { data, error } = await db.from( 'products' )
            .select( 'id, name, status, categories(name), product_images(image_url, display_order, is_primary), product_variants(id, color, size, stock_quantity, reserved_quantity, is_active)' )
            .eq( 'status', 'active' )
            .order( 'name' )
            .returns<TshirtProductRecord[]>();

        if ( error ) throw error;

        const products = ( data || [] ).flatMap( product =>
        {
            const category = Array.isArray( product.categories )
                ? product.categories[ 0 ]?.name
                : product.categories?.name;
            if ( !isBuyThreeTshirtProduct( product.name, category ) )
                return [];

            const variants = ( product.product_variants || [] )
                .filter( variant => variant.is_active && variant.stock_quantity - variant.reserved_quantity > 0 )
                .map( variant => ( {
                    id: variant.id,
                    color: variant.color || 'Default',
                    size: variant.size || 'One size',
                    stockQuantity: variant.stock_quantity - variant.reserved_quantity,
                } ) );
            if ( !variants.length )
                return [];

            const images = [ ...( product.product_images || [] ) ].sort(
                ( first, second ) => Number( first.display_order || 0 ) - Number( second.display_order || 0 )
            );
            return [ {
                productId: product.id,
                name: product.name,
                image: images.find( image => image.is_primary )?.image_url
                    || images[ 0 ]?.image_url
                    || '/images/brand/scotland-lion.png',
                variants,
            } ];
        } );

        return NextResponse.json( { products }, { headers: { 'Cache-Control': 'no-store' } } );
    } catch ( error )
    {
        console.error( 'Could not load in-stock T-shirt gifts:', error );
        return NextResponse.json( { error: 'Could not load free T-shirt options. Please try again.' }, { status: 500 } );
    }
}
