import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { ProductCard } from '@/components/ProductCard';
import { getPublicCategoryBySlug, getCategorySlugRedirect } from '@/lib/category-data';
import { getAllProducts } from '@/lib/data';
import { absoluteSiteUrl, safeJsonLd } from '@/lib/seo';
import { AnalyticsPageView } from '@/components/AnalyticsPageView';

export const dynamic = 'force-dynamic';

async function getCategoryPageData ( slug: string )
{
    const category = await getPublicCategoryBySlug( slug );
    if ( !category ) return undefined;
    const products = ( await getAllProducts() ).filter( product =>
        product.category.trim().toLowerCase() === category.name.trim().toLowerCase()
    );
    return { category, products };
}

export async function generateMetadata ( { params }: { params: Promise<{ slug: string }> } ): Promise<Metadata>
{
    const { slug } = await params;
    const data = await getCategoryPageData( slug );
    if ( !data ) return { title: 'Collection not found | SCOTLAND', robots: { index: false, follow: true } };
    const { category, products } = data;
    const isIndexable = products.filter( product => !product.no_index ).length >= 3;
    return {
        title: category.seo_title || `${ category.name } | SCOTLAND`,
        description: category.seo_description || category.description || `Explore the ${ category.name } collection from SCOTLAND.`,
        alternates: { canonical: absoluteSiteUrl( `/category/${ category.slug }` ) },
        robots: { index: isIndexable, follow: true },
        openGraph: {
            title: category.seo_title || `${ category.name } | SCOTLAND`,
            description: category.seo_description || category.description || `Explore the ${ category.name } collection from SCOTLAND.`,
        },
    };
}

export default async function CategoryPage ( { params }: { params: Promise<{ slug: string }> } )
{
    const { slug } = await params;
    const data = await getCategoryPageData( slug );
    if ( !data )
    {
        const redirectSlug = await getCategorySlugRedirect( slug );
        if ( redirectSlug ) permanentRedirect( `/category/${ redirectSlug }` );
        notFound();
    }
    const { category, products } = data;
    const url = absoluteSiteUrl( `/category/${ category.slug }` );
    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteSiteUrl( '/' ) },
            { '@type': 'ListItem', position: 2, name: 'Shop', item: absoluteSiteUrl( '/shop' ) },
            { '@type': 'ListItem', position: 3, name: category.name, item: url },
        ],
    };

    return (
        <main className="shell py-8 sm:py-12">
            <AnalyticsPageView listName={ category.name } />
            <script type="application/ld+json" dangerouslySetInnerHTML={ { __html: safeJsonLd( breadcrumbSchema ) } } />
            <nav aria-label="Breadcrumb" className="mb-6 text-xs text-zinc-500">
                <ol className="flex flex-wrap items-center gap-2">
                    <li><Link className="hover:text-navy" href="/">Home</Link></li>
                    <li aria-hidden="true">/</li>
                    <li><Link className="hover:text-navy" href="/shop">Shop</Link></li>
                    <li aria-hidden="true">/</li>
                    <li aria-current="page" className="text-navy">{ category.name }</li>
                </ol>
            </nav>

            <header className="grid items-center gap-8 border-b border-stone pb-8 sm:pb-10 lg:grid-cols-[1fr_0.8fr]">
                <div>
                    <p className="eyebrow text-zinc-500">SCOTLAND · THE COLLECTION</p>
                    <h1 className="display mt-3 text-4xl sm:text-5xl">{ category.name }</h1>
                    { category.description && <p className="mt-4 max-w-2xl leading-7 text-zinc-600">{ category.description }</p> }
                </div>
                { products[ 0 ]?.image && (
                    <div className="relative hidden aspect-[2/1] overflow-hidden bg-stone lg:block">
                        <Image src={ products[ 0 ].image } alt={ products[ 0 ].image_alt_text || category.name } fill className="object-cover" sizes="40vw" />
                    </div>
                ) }
            </header>

            <p className="mt-6 text-sm text-zinc-500">{ products.length } { products.length === 1 ? 'piece' : 'pieces' }</p>
            { products.length ? (
                <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                    { products.map( product => <ProductCard key={ product.id } product={ product } /> ) }
                </div>
            ) : (
                <p className="py-16 text-center text-sm text-zinc-500">This collection is being refreshed. Explore the full <Link className="underline" href="/shop">shop</Link>.</p>
            ) }
        </main>
    );
}
