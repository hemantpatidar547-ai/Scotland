import { getAllProducts } from '@/lib/data';
import { WishlistProducts } from '@/components/WishlistProducts';

export const dynamic = 'force-dynamic';

export default async function Wishlist ()
{
	const products = await getAllProducts();
	return <main className="shell py-12"><h1 className="display text-5xl">Wishlist</h1><WishlistProducts products={ products } /></main>;
}
