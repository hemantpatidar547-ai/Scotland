import { notFound } from 'next/navigation';
import { getProductBySlug, getAllProducts } from '@/lib/data';
import { ProductDetails } from './product-details';

// Pre-build all product pages at startup
export async function generateStaticParams ()
{
    const products = await getAllProducts();
    return products.map( p => ( { slug: p.slug } ) );
}

export async function generateMetadata ( { params }: { params: Promise<{ slug: string }> } )
{
    const { slug } = await params;
    const product = await getProductBySlug( slug );
    if ( !product )
    {
        return {
            title: 'Product not found – Scotland',
            description: 'The requested product does not exist.',
        };
    }
    return {
        title: `${ product.name } – Scotland`,
        description: product.shortDescription || product.description,
        openGraph: {
            images: [ product.image ],
        },
    };
}

export default async function ProductPage ( { params }: { params: Promise<{ slug: string }> } )
{
    const { slug } = await params;
    const product = await getProductBySlug( slug );
    if ( !product ) notFound();
    return <ProductDetails product={ product } />;
}
