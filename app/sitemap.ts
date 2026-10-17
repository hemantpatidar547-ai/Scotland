import type { MetadataRoute } from 'next';
import { getPublicCategories } from '@/lib/category-data';
import { getAllProducts } from '@/lib/data';
import { absoluteSiteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export default async function sitemap (): Promise<MetadataRoute.Sitemap>
{
    const staticPaths = [ '/', '/shop', '/about', '/contact', '/collections', '/complete-looks' ];
    const [ products, categories ] = await Promise.all( [ getAllProducts(), getPublicCategories() ] );
    const entries: MetadataRoute.Sitemap = staticPaths.map( path => ( {
        url: absoluteSiteUrl( path ),
        changeFrequency: path === '/' ? 'daily' : 'weekly',
        priority: path === '/' ? 1 : 0.7,
    } ) );

    entries.push( ...products
        .filter( product =>
            product.status === 'published' &&
            !product.no_index &&
            Boolean( product.slug ) &&
            ( !product.canonical_url || product.canonical_url === absoluteSiteUrl( `/products/${ product.slug }` ) )
        )
        .map( product => ( {
            url: absoluteSiteUrl( `/products/${ product.slug }` ),
            lastModified: product.updatedAt ? new Date( product.updatedAt ) : undefined,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        } ) ) );

    entries.push( ...categories
        .filter( category =>
            products.filter( product =>
                product.status === 'published' &&
                !product.no_index &&
                product.category.trim().toLowerCase() === category.name.trim().toLowerCase()
            ).length >= 3
        )
        .map( category => ( {
            url: absoluteSiteUrl( `/category/${ category.slug }` ),
            lastModified: category.updated_at ? new Date( category.updated_at ) : undefined,
            changeFrequency: 'weekly' as const,
            priority: 0.7,
        } ) ) );

    return entries;
}
