import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { permanentRedirect } from 'next/navigation';
import { getProductBySlug, getProductSlugRedirect } from '@/lib/data';
import { absoluteSiteUrl, isPublicHttpUrl, safeJsonLd } from '@/lib/seo';
import { getAllProducts } from '@/lib/data';
import { getRecommendedProducts } from '@/lib/product-recommendations';
import { ProductDetails } from './product-details';

export const dynamic = 'force-dynamic';

export async function generateMetadata ( { params }: { params: Promise<{ slug: string }> } ): Promise<Metadata>
{
    const { slug } = await params;
    const product = await getProductBySlug( slug );
    if ( !product )
    {
        return {
            title: 'Product not found – Scotland',
            description: 'The requested product does not exist.',
            robots: { index: false, follow: true },
        };
    }
    const canonical = product.canonical_url && isPublicHttpUrl( product.canonical_url )
        ? product.canonical_url
        : absoluteSiteUrl( `/products/${ product.slug }` );
    return {
        title: product.seo_title || `${ product.name } – ${ product.brand_name || 'SCOTLAND' }`,
        description: product.meta_description || product.shortDescription || product.description,
        alternates: { canonical },
        robots: product.no_index ? { index: false, follow: true } : { index: true, follow: true },
        openGraph: {
            title: product.seo_title || product.name,
            description: product.meta_description || product.shortDescription || product.description,
            images: isPublicHttpUrl( product.image ) ? [ product.image ] : [],
        },
    };
}

export default async function ProductPage ( { params }: { params: Promise<{ slug: string }> } )
{
    const { slug } = await params;
    const product = await getProductBySlug( slug );
    if ( !product )
    {
        const redirectSlug = await getProductSlugRedirect( slug );
        if ( redirectSlug ) permanentRedirect( `/products/${ redirectSlug }` );
        notFound();
    }
    const recommendedProducts = getRecommendedProducts( product, await getAllProducts() );

    const url = absoluteSiteUrl( `/products/${ product.slug }` );
    const images = product.images.filter( isPublicHttpUrl );
    const availability = ( product.stock || 0 ) > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock';
    const variants = product.inventoryVariants || [];
    const baseOffer = {
        '@type': 'Offer',
        priceCurrency: 'INR',
        price: product.salePrice || product.price,
        availability,
        itemCondition: 'https://schema.org/NewCondition',
        url,
    };
    const productSchema: Record<string, unknown> = variants.length
        ? {
            '@context': 'https://schema.org',
            '@type': 'ProductGroup',
            productGroupID: product.sku || product.id,
            name: product.name,
            description: product.description,
            brand: { '@type': 'Brand', name: product.brand_name || 'SCOTLAND' },
            sku: product.sku,
            url,
            image: images,
            variesBy: [ 'https://schema.org/size', 'https://schema.org/color' ],
            hasVariant: variants.map( variant => ( {
                '@type': 'Product',
                name: `${ product.name } - ${ variant.color } - ${ variant.size }`,
                sku: variant.sku,
                color: variant.color,
                size: variant.size,
                brand: { '@type': 'Brand', name: product.brand_name || 'SCOTLAND' },
                image: images,
                offers: {
                    ...baseOffer,
                    price: variant.salePrice || variant.price || product.salePrice || product.price,
                    availability: variant.stockQuantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                },
            } ) ),
        }
        : {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: product.description,
            image: images,
            sku: product.sku,
            brand: { '@type': 'Brand', name: product.brand_name || 'SCOTLAND' },
            offers: baseOffer,
        };
    if ( product.reviews > 0 && product.rating > 0 )
    {
        productSchema.aggregateRating = {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            reviewCount: product.reviews,
        };
    }
    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteSiteUrl( '/' ) },
            { '@type': 'ListItem', position: 2, name: 'Shop', item: absoluteSiteUrl( '/shop' ) },
            { '@type': 'ListItem', position: 3, name: product.name, item: url },
        ],
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={ { __html: safeJsonLd( productSchema ) } } />
            <script type="application/ld+json" dangerouslySetInnerHTML={ { __html: safeJsonLd( breadcrumbSchema ) } } />
            <ProductDetails product={ product } recommendedProducts={ recommendedProducts } />
        </>
    );
}
