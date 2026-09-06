import { z } from 'zod';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

const schema = z.object( {
    name: z.string().min( 2 ),
    slug: z.string().min( 2 ),
    description: z.string().trim().min( 10 ),
    sku: z.string().min( 2 ),
    price: z.number().positive(),
    category: z.string().optional(),
    stock_quantity: z.number().int().min( 0 ).default( 0 ),
    image: z.string().nullable().optional()
} );

export async function POST ( request: Request )
{
    try
    {
        const json = await request.json();
        const input = schema.safeParse( json );

        if ( !input.success )
        {
            return NextResponse.json( { error: input.error.flatten() }, { status: 400 } );
        }

        if ( !supabaseAdmin )
        {
            return NextResponse.json( { error: 'Supabase server key is missing. Add SUPABASE_SERVICE_ROLE_KEY to .env.local.' }, { status: 503 } );
        }

        const { data: category } = input.data.category
            ? await supabaseAdmin.from( 'categories' ).select( 'id' ).eq( 'name', input.data.category ).maybeSingle()
            : { data: null };

        const { data: product, error: productError } = await supabaseAdmin
            .from( 'products' )
            .insert( {
                name: input.data.name,
                slug: input.data.slug,
                description: input.data.description,
                short_description: input.data.description,
                category_id: category?.id || null,
                price: input.data.price,
                sku: input.data.sku,
                status: 'active',
                is_new_arrival: true
            } )
            .select( 'id' )
            .single();

        if ( productError || !product )
        {
            if ( productError?.code === 'PGRST205' )
            {
                return NextResponse.json( { error: 'Supabase products table is missing. Run supabase/migrations/0001_ecommerce.sql in the Supabase SQL Editor first.' }, { status: 503 } );
            }
            return NextResponse.json( { error: productError?.message || 'Product could not be saved.' }, { status: 400 } );
        }

        const { error: variantError } = await supabaseAdmin.from( 'product_variants' ).insert( {
            product_id: product.id,
            sku: input.data.sku,
            stock_quantity: input.data.stock_quantity,
            image_url: input.data.image || null
        } );

        if ( variantError )
        {
            await supabaseAdmin.from( 'products' ).delete().eq( 'id', product.id );
            return NextResponse.json( { error: variantError.message }, { status: 400 } );
        }

        if ( input.data.image )
        {
            const { error: imageError } = await supabaseAdmin.from( 'product_images' ).insert( {
                product_id: product.id,
                image_url: input.data.image,
                alt_text: input.data.name,
                is_primary: true
            } );

            if ( imageError )
            {
                await supabaseAdmin.from( 'products' ).delete().eq( 'id', product.id );
                return NextResponse.json( { error: imageError.message }, { status: 400 } );
            }
        }

        return NextResponse.json( { data: { id: product.id } }, { status: 201 } );
    } catch ( error: any )
    {
        console.error( 'Supabase product insert error:', error );
        return NextResponse.json( { error: error.message }, { status: 500 } );
    }
}
