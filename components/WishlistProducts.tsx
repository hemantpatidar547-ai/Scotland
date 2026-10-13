'use client';

import Link from 'next/link';
import { Product } from '@/types/product';
import { ProductCard } from './ProductCard';
import { useStore } from './StoreProvider';

export function WishlistProducts ( { products }: { products: Product[] } )
{
    const { favorites, isReady, syncError } = useStore();
    const items = products.filter( product => favorites.includes( product.id ) );

    if ( !isReady ) return <div className="mt-10 bg-white p-12 text-center text-zinc-500">Loading your saved pieces…</div>;

    if ( !items.length )
    {
        return <div className="mt-10 bg-white p-12 text-center"><p>No saved pieces yet.</p><Link className="button mt-5" href="/shop">Explore the collection</Link></div>;
    }

    return <div>
        { syncError && <p className="mt-5 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">{ syncError }</p> }
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">{ items.map( product => <ProductCard key={ product.id } product={ product } /> ) }</div>
    </div>;
}