'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cartItemKey, useStore } from '@/components/StoreProvider';

const money = ( amount: number ) => new Intl.NumberFormat( 'en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
} ).format( amount );

export default function Cart ()
{
    const { cart, removeFromCart, setQty, isReady, syncError } = useStore();
    const subtotal = cart.reduce( ( total, item ) => total + ( item.product.salePrice || item.product.price ) * item.quantity, 0 );
    const shipping = subtotal >= 4000 ? 0 : 50;

    if ( !isReady ) return <main className="shell py-24 text-center"><p className="text-zinc-500">Loading your saved cart…</p></main>;

    if ( !cart.length )
    {
        return (
            <main className="shell py-24 text-center">
                <h1 className="display text-5xl">Your bag is empty.</h1>
                <p className="mt-4 text-zinc-600">Find something built for your everyday.</p>
                <Link className="button mt-7" href="/shop">Continue shopping</Link>
            </main>
        );
    }

    return (
        <main className="shell py-12">
            <h1 className="display text-5xl">Your bag</h1>
            { syncError && <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">{ syncError }</p> }
            <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
                <div>
                    { cart.map( item =>
                    {
                        const key = cartItemKey( item );
                        const unitPrice = item.product.salePrice || item.product.price;
                        return (
                            <article className="flex gap-4 border-t border-stone py-5" key={ key }>
                                <div className="relative h-32 w-24 shrink-0 bg-stone">
                                    <Image src={ item.product.image } alt={ item.product.name } fill className="object-cover" sizes="96px" />
                                </div>
                                <div className="flex flex-1 flex-col">
                                    <div className="flex justify-between gap-3">
                                        <div>
                                            <h2 className="font-semibold">{ item.product.name }</h2>
                                            <p className="mt-1 text-xs text-zinc-500">{ item.color } · { item.size }</p>
                                        </div>
                                        <b>{ money( unitPrice * item.quantity ) }</b>
                                    </div>
                                    <div className="mt-auto flex items-center justify-between">
                                        <select aria-label={ `Quantity for ${ item.product.name } ${ item.size }` } className="border border-stone bg-white px-2 py-1 text-xs" value={ item.quantity } onChange={ event => setQty( key, Number( event.target.value ) ) }>
                                            { [ 1, 2, 3, 4, 5 ].map( quantity => <option key={ quantity }>{ quantity }</option> ) }
                                        </select>
                                        <button className="text-xs text-highland underline" onClick={ () => removeFromCart( key ) }>Remove</button>
                                    </div>
                                </div>
                            </article>
                        );
                    } ) }
                </div>
                <aside className="h-fit bg-white p-6">
                    <h2 className="display text-2xl">Order summary</h2>
                    <div className="mt-6 space-y-3 border-b border-stone pb-5 text-sm">
                        <div className="flex justify-between"><span>Subtotal</span><span>{ money( subtotal ) }</span></div>
                        <div className="flex justify-between"><span>Shipping</span><span>{ shipping ? money( shipping ) : 'Free' }</span></div>
                    </div>
                    <div className="flex justify-between py-5 font-semibold"><span>Total</span><span>{ money( subtotal + shipping ) }</span></div>
                    <Link className="button w-full" href="/checkout">Secure checkout</Link>
                </aside>
            </div>
        </main>
    );
}
