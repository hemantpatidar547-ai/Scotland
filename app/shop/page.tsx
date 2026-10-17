

import { getAllProducts } from '@/lib/data';
import { ProductCard } from '@/components/ProductCard';
import Link from 'next/link';
import { AnalyticsPageView } from '@/components/AnalyticsPageView';
import { getPublicCategories } from '@/lib/category-data';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Shop – Scotland Collection',
  description: 'Explore the full range of premium Scottish-inspired clothing and accessories.',
};

export default async function ShopPage ()
{
  const [ products, categories ] = await Promise.all( [ getAllProducts(), getPublicCategories() ] );
  const eligibleCategories = categories.filter( category =>
    products.filter( product => product.status === 'published' && !product.no_index &&
      product.category.trim().toLowerCase() === category.name.trim().toLowerCase()
    ).length >= 3
  );
  return (
    <main className="shell py-12">
      <AnalyticsPageView listName="All products" />
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow text-stone/80">All Products</p>
          <h1 className="display mt-3 text-4xl">Shop the Collection</h1>
        </div>
        { eligibleCategories.length > 0 && (
          <nav aria-label="Product categories" className="mb-8 flex flex-wrap gap-2">
            { eligibleCategories.map( category => <Link key={ category.id } href={ `/category/${ category.slug }` } className="rounded-full border border-stone px-4 py-2 text-xs text-navy transition hover:border-navy">{ category.name }</Link> ) }
          </nav>
        ) }
        <Link className="eyebrow border-b border-navy pb-1" href="/" aria-label="Back to home">
          ← Home
        </Link>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        { products.map( ( product ) => (
          <ProductCard key={ product.id } product={ product } />
        ) ) }
      </div>
    </main>
  );
}
