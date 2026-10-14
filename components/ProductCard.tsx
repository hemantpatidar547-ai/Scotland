'use client';
import Image from 'next/image';
import Link from 'next/link';
import { Product } from '@/types/product';
import { useStore } from './StoreProvider';

const money = ( n: number ) => new Intl.NumberFormat( 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 } ).format( n );

export function ProductCard ( { product }: { product: Product } )
{
	const { favorites, toggleFavorite, addToCart, isReady } = useStore();
	const productPath = `/products/${ product.slug }`;

	return (
		<Link href={ productPath } className="group block cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navy">
			<article>
				<div className="relative aspect-[.78] overflow-hidden bg-stone">
					<Image className="object-cover transition duration-500 group-hover:scale-105" src={ product.image } alt={ product.name } fill sizes="(max-width: 640px) 50vw, 25vw" />
					{ ( product.isNew || product.isBestSeller ) && <span className="absolute left-3 top-3 bg-cream px-2 py-1 font-mono text-[9px] uppercase">{ product.isNew ? 'New' : 'Best seller' }</span> }
					<button onClick={ event => { event.preventDefault(); event.stopPropagation(); toggleFavorite( product.id ); } } className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-lg hover:bg-white transition-colors" aria-label="Save to wishlist">{ favorites.includes( product.id ) ? '♥' : '♡' }</button>
				</div>
				<div className="pt-3">
					<p className="eyebrow text-zinc-500">{ product.category }</p>
					<p className="mt-1 block text-sm font-semibold">{ product.name }</p>

					{ product.status === 'draft' ? (
						<p className="mt-2 text-xs font-bold uppercase tracking-wider text-red-600">Product Not Available</p>
					) : (
						<>
							<div className="mt-1 flex justify-between text-sm"><span>{ money( product.salePrice || product.price ) }</span><span className="text-gold">★ { product.rating }</span></div>
							<button disabled={ !isReady } onClick={ event => { event.preventDefault(); event.stopPropagation(); void addToCart( product, product.sizes[ 0 ], product.colors[ 0 ] ); } } className="mt-3 border-b border-navy pb-1 font-mono text-[10px] uppercase tracking-wider hover:text-gold transition-colors disabled:cursor-wait disabled:opacity-50">Quick add +</button>
						</>
					) }
				</div>
			</article>
		</Link>
	);
}
