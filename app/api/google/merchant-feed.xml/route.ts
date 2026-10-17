import { NextResponse } from 'next/server';
import { createMerchantFeedXml } from '@/lib/merchant-feed';
import { getAllProducts } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET ()
{
    try
    {
        const products = await getAllProducts( true );
        const xml = createMerchantFeedXml( products );
        return new NextResponse( xml, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        } );
    } catch ( error )
    {
        console.error( 'Merchant Center feed generation failed:', error );
        return NextResponse.json( { error: 'Product feed is temporarily unavailable.' }, { status: 503 } );
    }
}
