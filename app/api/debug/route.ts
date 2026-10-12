import { NextResponse } from 'next/server';
import { getAllProducts } from '@/lib/data';

export async function GET ()
{
    try
    {
        const products = await getAllProducts();

        const mapped = products.map( p => ( {
            id: p.id,
            name: p.name,
            status: p.status,
            sizes: p.sizes,
            colors: p.colors
        } ) );

        return NextResponse.json( {
            count: products.length,
            products: mapped
        } );
    } catch ( e: any )
    {
        return NextResponse.json( { error: e.message || 'Unknown error' }, { status: 500 } );
    }
}
