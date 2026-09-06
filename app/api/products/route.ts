import { NextResponse } from 'next/server';
import { getAllProducts } from '@/lib/data';

export async function GET ()
{
    const allProducts = await getAllProducts();
    return NextResponse.json( { data: allProducts, count: allProducts.length } );
}
