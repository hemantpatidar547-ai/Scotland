import Link from 'next/link';
import { getAllProducts } from '@/lib/data';
import { getPublicCategories } from '@/lib/category-data';
import { validateMerchantProducts } from '@/lib/merchant-feed';
import { absoluteSiteUrl } from '@/lib/seo';
import { getSupabaseAdmin } from '@/lib/supabase/db';

export const dynamic = 'force-dynamic';

const statusStyle = {
    Healthy: 'bg-emerald-50 text-emerald-800',
    'Needs Attention': 'bg-amber-50 text-amber-800',
    Pending: 'bg-sky-50 text-sky-800',
    Error: 'bg-rose-50 text-rose-800',
};

function Status ( { value }: { value: keyof typeof statusStyle } )
{
    return <span className={ `rounded-full px-3 py-1 text-xs font-semibold ${ statusStyle[ value ] }` }>{ value }</span>;
}

export default async function SeoAdminPage ()
{
    let products: Awaited<ReturnType<typeof getAllProducts>> = [];
    let categories: Awaited<ReturnType<typeof getPublicCategories>> = [];
    let loadError = '';
    let redirectsReady = false;
    try
    {
        [ products, categories ] = await Promise.all( [ getAllProducts( true ), getPublicCategories() ] );
    } catch ( error )
    {
        loadError = error instanceof Error ? error.message : 'SEO data could not be loaded.';
        console.error( 'SEO Center data loading failed:', error );
    }

    if ( !loadError )
    {
        const db = getSupabaseAdmin();
        const [ productRedirects, categoryRedirects ] = await Promise.all( [
            db.from( 'product_slug_redirects' ).select( 'old_slug' ).limit( 1 ),
            db.from( 'category_slug_redirects' ).select( 'old_slug' ).limit( 1 ),
        ] );
        const missingMigration = [ productRedirects.error, categoryRedirects.error ].some( error =>
            error?.code === '42P01' || error?.code === 'PGRST205'
        );
        if ( missingMigration )
        {
            console.warn( 'Slug redirect checks are pending: apply supabase/migrations/0005_product_slug_redirects.sql.' );
        } else if ( productRedirects.error || categoryRedirects.error )
        {
            console.error( 'Slug redirect readiness check failed:', productRedirects.error || categoryRedirects.error );
        } else
        {
            redirectsReady = true;
        }
    }

    const published = products.filter( product => product.status === 'published' );
    const indexable = published.filter( product => !product.no_index );
    const complete = published.filter( product =>
        Boolean( product.seo_title?.trim() ) &&
        Boolean( product.meta_description?.trim() ) &&
        Boolean( product.focus_keyword?.trim() ) &&
        Boolean( product.image_alt_text?.trim() ) &&
        Boolean( product.slug?.trim() )
    ).length;
    const missing = published.flatMap( product =>
    {
        const fields = [
            ...(!product.seo_title?.trim() ? [ 'SEO title' ] : []),
            ...(!product.meta_description?.trim() ? [ 'meta description' ] : []),
            ...(!product.focus_keyword?.trim() ? [ 'focus keyword' ] : []),
            ...(!product.image_alt_text?.trim() ? [ 'image alt text' ] : []),
        ];
        return fields.length ? [ { id: product.id, name: product.name, fields } ] : [];
    } );
    const feed = validateMerchantProducts( products );
    const slugCounts = new Map<string, number>();
    published.forEach( product => slugCounts.set( product.slug, ( slugCounts.get( product.slug ) || 0 ) + 1 ) );
    const duplicateSlugCount = published.filter( product => ( slugCounts.get( product.slug ) || 0 ) > 1 ).length;
    const invalidSlugs = published.filter( product => !product.slug.trim() ).length;
    const sitemapUrl = absoluteSiteUrl( '/sitemap.xml' );
    const feedUrl = absoluteSiteUrl( '/api/google/merchant-feed.xml' );
    const healthy = !loadError && published.length > 0;

    return (
        <main className="shell py-10 sm:py-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="eyebrow">Search visibility</p>
                    <h1 className="display mt-3 text-4xl sm:text-5xl">SEO &amp; Google Products</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">Technical discovery and feed checks for public products. Google crawling, indexing, eligibility, and placement are determined by Google and are not guaranteed here.</p>
                </div>
                <Link className="button-outline" href="/admin/products">Edit products</Link>
            </div>

            { loadError && <div role="alert" className="mt-8 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">SEO data error: { loadError }</div> }

            <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <article className="border border-stone bg-white p-5">
                    <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">SEO health</h2><Status value={ loadError ? 'Error' : missing.length ? 'Needs Attention' : healthy ? 'Healthy' : 'Pending' } /></div>
                    <p className="mt-4 text-3xl font-semibold">{ complete } / { published.length }</p>
                    <p className="mt-2 text-sm text-zinc-500">Published products with title, description, keyword, slug, and image alt text.</p>
                </article>
                <article className="border border-stone bg-white p-5">
                    <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Sitemap</h2><Status value={ loadError ? 'Error' : 'Healthy' } /></div>
                    <p className="mt-4 text-3xl font-semibold">{ indexable.length }</p>
                    <p className="mt-2 text-sm text-zinc-500">Indexable published product URLs. Thin categories are excluded.</p>
                    <a className="mt-3 inline-block break-all text-sm text-navy underline" href={ sitemapUrl }>{ sitemapUrl }</a>
                </article>
                <article className="border border-stone bg-white p-5">
                    <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Merchant Center feed</h2><Status value={ loadError ? 'Error' : feed.issues.length ? 'Needs Attention' : published.length ? 'Healthy' : 'Pending' } /></div>
                    <p className="mt-4 text-3xl font-semibold">{ feed.eligible.length } eligible · { feed.issues.length } issues</p>
                    <p className="mt-2 text-sm text-zinc-500">Eligibility checks are local only; they do not mean Google approved these products.</p>
                    <a className="mt-3 inline-block break-all text-sm text-navy underline" href={ feedUrl }>{ feedUrl }</a>
                </article>
                <article className="border border-stone bg-white p-5">
                    <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Search Console</h2><Status value="Pending" /></div>
                    <p className="mt-4 text-3xl font-semibold">Not connected</p>
                    <p className="mt-2 text-sm text-zinc-500">No live impressions, clicks, queries, or indexing data is available until an owner verifies the property and configures authorized API access.</p>
                </article>
                <article className="border border-stone bg-white p-5">
                    <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">GA4 analytics</h2><Status value={ process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? 'Healthy' : 'Pending' } /></div>
                    <p className="mt-4 text-3xl font-semibold">{ process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? 'Consent gated' : 'Not configured' }</p>
                    <p className="mt-2 text-sm text-zinc-500">{ process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? 'Events run only after consent. Actual reports are available in the configured Google Analytics property.' : 'Set NEXT_PUBLIC_GA_MEASUREMENT_ID to enable consent-gated event reporting.' }</p>
                </article>
                <article className="border border-stone bg-white p-5">
                    <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">URLs &amp; redirects</h2><Status value={ !loadError && ( invalidSlugs > 0 || duplicateSlugCount > 0 ) ? 'Needs Attention' : redirectsReady ? 'Healthy' : 'Pending' } /></div>
                    <p className="mt-4 text-3xl font-semibold">{ invalidSlugs + duplicateSlugCount } URL issues</p>
                    <p className="mt-2 text-sm text-zinc-500">Product slugs are checked for missing values and duplicates. Historical redirects require migration 0005.</p>
                </article>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="border border-stone bg-white p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="display text-2xl">Product metadata alerts</h2>
                        <Status value={ loadError ? 'Error' : missing.length ? 'Needs Attention' : 'Healthy' } />
                    </div>
                    { missing.length ? (
                        <ul className="mt-4 divide-y divide-stone">
                            { missing.slice( 0, 12 ).map( product => <li key={ product.id } className="py-3 text-sm"><span className="font-medium">{ product.name }</span><span className="mt-1 block text-zinc-500">Missing: { product.fields.join( ', ' ) }</span><Link className="mt-1 inline-block text-navy underline" href={ `/admin/products/${ product.id }` }>Edit product</Link></li> ) }
                        </ul>
                    ) : <p className="mt-4 text-sm text-zinc-500">No missing SEO fields detected.</p> }
                </div>

                <div className="border border-stone bg-white p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="display text-2xl">Feed validation</h2>
                        <Status value={ loadError ? 'Error' : feed.issues.length ? 'Needs Attention' : feed.eligible.length ? 'Healthy' : 'Pending' } />
                    </div>
                    { feed.issues.length ? (
                        <ul className="mt-4 divide-y divide-stone">
                            { feed.issues.slice( 0, 12 ).map( issue => <li key={ issue.productId } className="py-3 text-sm"><span className="font-medium">{ issue.productName }</span><span className="mt-1 block text-zinc-500">{ issue.reason }</span></li> ) }
                        </ul>
                    ) : <p className="mt-4 text-sm text-zinc-500">{ feed.eligible.length ? 'No feed validation issues found.' : 'No published products to validate.' }</p> }
                    <p className="mt-4 text-xs text-zinc-500">Categories available: { categories.length }. Manage category titles, slugs, and descriptions in <Link className="underline" href="/admin/categories">category settings</Link>.</p>
                </div>
            </section>

            <section className="mt-6 border border-stone bg-white p-5 sm:p-6">
                <h2 className="display text-2xl">Google setup</h2>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-600">
                    <li>Set <code>NEXT_PUBLIC_SITE_URL</code> in Vercel to the verified public HTTPS origin, then redeploy.</li>
                    <li>Verify the site in Google Search Console, submit <code>/sitemap.xml</code>, and use URL Inspection to request crawling where appropriate.</li>
                    <li>Claim and verify the same site in Merchant Center, add the feed URL above, select India and INR, and review Google’s diagnostics and policies.</li>
                    <li>For live Search Console reports or Merchant API status, configure a server-side Google OAuth integration and least-privilege credentials. No Google credentials or live data are configured by this application yet.</li>
                    <li>GA4 runs only after a visitor accepts analytics consent. Add <code>NEXT_PUBLIC_GA_MEASUREMENT_ID</code> to enable it.</li>
                </ol>
                <p className="mt-4 text-xs text-zinc-500">After creating or editing categories, map products to the category using the same category name in the product form. A category is listed as indexable only when it has at least three published, indexable products.</p>
            </section>
        </main>
    );
}
