

import { getAllProducts } from '@/lib/data';
import { ProductCard } from '@/components/ProductCard';
import Link from 'next/link';

export const metadata = {
  title: 'Shop – Scotland Collection',
  description: 'Explore the full range of premium Scottish-inspired clothing and accessories.',
};

export default async function ShopPage ()
{
  const products = await getAllProducts();
  return (
    <main className="shell py-12">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow text-stone/80">All Products</p>
          <h1 className="display mt-3 text-4xl">Shop the Collection</h1>
        </div>
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
