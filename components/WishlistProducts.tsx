'use client';

import Link from 'next/link';
import { Product } from '@/types/product';
import { ProductCard } from './ProductCard';
import { useStore } from './StoreProvider';

export function WishlistProducts ( { products }: { products: Product[] } )
{
    const { favorites } = useStore();
    const items = products.filter( product => favorites.includes( product.id ) );

    if ( !items.length )
    {
        return <div className="mt-10 bg-white p-12 text-center"><p>No saved pieces yet.</p><Link className="button mt-5" href="/shop">Explore the collection</Link></div>;
    }

    return <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">{ items.map( product => <ProductCard key={ product.id } product={ product } /> ) }</div>;
}