import { NextResponse } from 'next/server';
import { getAllProducts } from '@/lib/data';

export async function GET ()
{
    const products = await getAllProducts();
    return NextResponse.json( { data: products } );
}
