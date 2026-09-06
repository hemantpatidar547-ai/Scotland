import { z } from 'zod';
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

const schema = z.object( {
    name: z.string().min( 2 ),
    slug: z.string().min( 2 ),
    description: z.string().min( 10 ),
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

        const client = await clientPromise;
        const db = client.db( 'scotland' );

        const productData = {
            ...input.data,
            createdAt: new Date(),
            status: 'draft'
        };

        const result = await db.collection( 'products' ).insertOne( productData );

        return NextResponse.json( { data: { id: result.insertedId.toString() } }, { status: 201 } );
    } catch ( error: any )
    {
        console.error( 'MongoDB Insert Error:', error );
        return NextResponse.json( { error: error.message }, { status: 500 } );
    }
}
