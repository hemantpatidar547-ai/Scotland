import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createProduct } from '@/backend/products/create-product';

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

        const result = await createProduct( input.data );
        return result.data
            ? NextResponse.json( result, { status: result.status } )
            : NextResponse.json( { error: result.error }, { status: result.status } );
    } catch ( error: any )
    {
        console.error( 'Supabase product insert error:', error );
        return NextResponse.json( { error: error.message }, { status: 500 } );
    }
}
