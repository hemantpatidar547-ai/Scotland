import { NextResponse } from 'next/server';
import { getAllProducts } from '@/lib/data';

export async function GET ( request: Request )
{
    const fresh = new URL( request.url ).searchParams.get( 'fresh' ) === '1';
    const products = await getAllProducts( fresh );
    return NextResponse.json( { data: products } );
}
