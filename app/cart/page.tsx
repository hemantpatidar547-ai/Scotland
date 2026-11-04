'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cartItemKey, useStore } from '@/components/StoreProvider';
import { getBuyThreeTshirtGiftCount, type BuyThreeTshirtOption } from '@/lib/buy-3-get-tshirt';

const money = ( amount: number ) => new Intl.NumberFormat( 'en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
} ).format( amount );

export default function Cart ()
{
    const { cart, promoGifts, addPromoGift, removePromoGift, removeFromCart, setQty, isReady, syncError } = useStore();
    const [ freeDeliveryOffer, setFreeDeliveryOffer ] = useState( false );
    const [ tshirtOptions, setTshirtOptions ] = useState<BuyThreeTshirtOption[]>( [] );
    const [ selectedProductId, setSelectedProductId ] = useState( '' );
    const [ selectedVariantId, setSelectedVariantId ] = useState( '' );
    const [ tshirtLoadError, setTshirtLoadError ] = useState( '' );
    const subtotal = cart.reduce( ( total, item ) => total + ( item.product.salePrice || item.product.price ) * item.quantity, 0 );
    const paidItemCount = cart.reduce( ( total, item ) => total + item.quantity, 0 );
    const eligibleGiftCount = getBuyThreeTshirtGiftCount( paidItemCount );
    const freeDelivery = freeDeliveryOffer || subtotal >= 4000;
    const selectedProduct = tshirtOptions.find( product => product.productId === selectedProductId );
    const selectedVariant = selectedProduct?.variants.find( variant => variant.id === selectedVariantId );

    useEffect( () =>
    {
        fetch( '/api/settings?t=' + Date.now() )
            .then( response =>
            {
                if ( !response.ok ) throw new Error( 'Could not load delivery settings.' );
                return response.json();
            } )
            .then( data => setFreeDeliveryOffer( data.freeDelivery === true ) )
            .catch( error => console.error( 'Could not load cart delivery settings:', error ) );
    }, [] );

    useEffect( () =>
    {
        const controller = new AbortController();
        fetch( '/api/promotions/buy-3-get-tshirt', { cache: 'no-store', signal: controller.signal } )
            .then( async response =>
            {
                const result = await response.json();
                if ( !response.ok ) throw new Error( result.error || 'Could not load free T-shirt options.' );
                return result.products as BuyThreeTshirtOption[];
            } )
            .then( products =>
            {
                setTshirtOptions( products );
                setSelectedProductId( products[ 0 ]?.productId || '' );
                setSelectedVariantId( products[ 0 ]?.variants[ 0 ]?.id || '' );
            } )
            .catch( error =>
            {
                if ( controller.signal.aborted ) return;
                console.error( 'Could not load free T-shirt options:', error );
                setTshirtLoadError( error instanceof Error ? error.message : 'Could not load free T-shirt options.' );
            } );
        return () => controller.abort();
    }, [] );

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
            <section className="mt-6 border border-gold/50 bg-[#f7f3e8] p-5 sm:flex sm:items-center sm:justify-between sm:gap-6" aria-labelledby="buy-three-offer">
                <div>
                    <p className="eyebrow text-gold">A little extra from SCOTLAND</p>
                    <h2 id="buy-three-offer" className="display mt-2 text-2xl">Buy 3, get a T-shirt free.</h2>
                    <p className="mt-1 text-sm text-zinc-600">
                        { eligibleGiftCount > 0
                            ? `You qualify for ${ eligibleGiftCount } free T-shirt${ eligibleGiftCount === 1 ? '' : 's' }. Choose an in-stock style and size below.`
                            : `Add ${ 3 - paidItemCount % 3 } more item${ 3 - paidItemCount % 3 === 1 ? '' : 's' } to unlock your first free T-shirt.` }
                    </p>
                </div>
                <Link href="/shop" className="button-outline mt-4 shrink-0 sm:mt-0">Shop collection</Link>
            </section>
            <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
                <div>
                    { cart.map( item =>
                    {
                        const key = cartItemKey( item );
                        const unitPrice = item.product.salePrice || item.product.price;
                        const availableStock = item.product.inventoryVariants?.find(
                            variant => variant.id === item.variantId
                        )?.stockQuantity ?? 0;
                        const quantityOptions = Array.from(
                            { length: Math.min( 5, availableStock ) },
                            ( _, index ) => index + 1
                        );
                        if ( item.quantity > availableStock ) quantityOptions.push( item.quantity );
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
                                            { quantityOptions.map( quantity => <option key={ quantity }>{ quantity }</option> ) }
                                        </select>
                                        <button className="text-xs text-highland underline" onClick={ () => removeFromCart( key ) }>Remove</button>
                                    </div>
                                    { item.quantity > availableStock && <p className="mt-2 text-xs text-red-700" role="status">
                                        Only { availableStock } available now. Reduce the quantity or remove this item.
                                    </p> }
                                </div>
                            </article>
                        );
                    } ) }
                    { eligibleGiftCount > 0 && <section className="mt-8 border border-stone bg-white p-5" aria-labelledby="free-tshirt-heading">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="eyebrow text-gold">Your offer</p>
                                <h2 id="free-tshirt-heading" className="display mt-1 text-xl">Choose your free T-shirt</h2>
                                <p className="mt-1 text-xs text-zinc-500">One free T-shirt for every 3 items in your bag. Pick the style, color and size you want.</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{ promoGifts.length } / { eligibleGiftCount } selected</span>
                        </div>
                        { tshirtLoadError ? <p className="mt-4 text-sm text-amber-800" role="alert">{ tshirtLoadError }</p>
                            : tshirtOptions.length === 0 ? <p className="mt-4 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Free T-shirts are not in stock yet. The offer will be ready as soon as a T-shirt is added and stocked.</p>
                                : <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                                    <label className="text-xs font-medium">
                                        T-shirt
                                        <select className="input mt-1" value={ selectedProductId } onChange={ event =>
                                        {
                                            const product = tshirtOptions.find( item => item.productId === event.target.value );
                                            setSelectedProductId( product?.productId || '' );
                                            setSelectedVariantId( product?.variants[ 0 ]?.id || '' );
                                        } }>
                                            { tshirtOptions.map( product => <option key={ product.productId } value={ product.productId }>{ product.name }</option> ) }
                                        </select>
                                    </label>
                                    <label className="text-xs font-medium">
                                        Color &amp; size
                                        <select className="input mt-1" value={ selectedVariantId } onChange={ event => setSelectedVariantId( event.target.value ) }>
                                            { selectedProduct?.variants.map( variant => <option key={ variant.id } value={ variant.id }>{ variant.color } · { variant.size } ({ variant.stockQuantity } left)</option> ) }
                                        </select>
                                    </label>
                                    <button
                                        type="button"
                                        className="button self-end disabled:opacity-40"
                                        disabled={ !selectedProduct || !selectedVariant || promoGifts.length >= eligibleGiftCount }
                                        onClick={ () =>
                                        {
                                            if ( !selectedProduct || !selectedVariant ) return;
                                            addPromoGift( {
                                                productId: selectedProduct.productId,
                                                variantId: selectedVariant.id,
                                                name: selectedProduct.name,
                                                image: selectedProduct.image,
                                                size: selectedVariant.size,
                                                color: selectedVariant.color,
                                            } );
                                        } }
                                    >
                                        Add free T-shirt
                                    </button>
                                </div> }
                        { promoGifts.length > 0 && <ul className="mt-4 divide-y divide-stone border-t border-stone">
                            { promoGifts.map( ( gift, index ) => <li key={ `${ gift.variantId }-${ index }` } className="flex items-center justify-between gap-3 py-3 text-sm">
                                <span>{ gift.name } · { gift.color} · { gift.size }</span>
                                <button type="button" className="text-xs text-highland underline" onClick={ () => removePromoGift( index ) }>Remove</button>
                            </li> ) }
                        </ul> }
                    </section> }
                </div>
                <aside className="h-fit bg-white p-6">
                    <h2 className="display text-2xl">Order summary</h2>
                    <div className="mt-6 space-y-3 border-b border-stone pb-5 text-sm">
                        <div className="flex justify-between"><span>Subtotal</span><span>{ money( subtotal ) }</span></div>
                        { promoGifts.length > 0 && <div className="flex justify-between font-medium text-emerald-700"><span>Free T-shirt{ promoGifts.length === 1 ? '' : 's' } × { promoGifts.length }</span><span>FREE</span></div> }
                        <div className="flex justify-between"><span>Delivery</span><span>{ freeDelivery ? 'Free' : 'Calculated at checkout' }</span></div>
                    </div>
                    <div className="flex justify-between py-5 font-semibold"><span>{ freeDelivery ? 'Total' : 'Items total' }</span><span>{ money( subtotal ) }</span></div>
                    { !freeDelivery && <p className="-mt-2 mb-4 text-xs leading-5 text-zinc-500">Enter your PIN code at checkout to calculate delivery based on courier availability and payment method.</p> }
                    <Link className="button w-full" href="/checkout">Secure checkout</Link>
                </aside>
            </div>
        </main>
    );
}
