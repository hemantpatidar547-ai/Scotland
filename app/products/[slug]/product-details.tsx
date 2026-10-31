'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Product } from '@/types/product';
import { useStore } from '@/components/StoreProvider';
import { ProductCard } from '@/components/ProductCard';
import { trackAnalyticsEvent } from '@/lib/analytics';

const money = ( n: number ) =>
  new Intl.NumberFormat( 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 } ).format( n );

/* ── Small helper: renders a detail row ── */
function DetailRow ( { label, value }: { label: string; value?: string | number | boolean | null } )
{
  if ( !value && value !== 0 ) return null;
  return (
    <div className="flex gap-5 border-b border-stone/60 py-4 last:border-0 sm:gap-8">
      <span className="w-28 shrink-0 text-sm font-medium uppercase tracking-wide text-zinc-500 sm:w-40">{ label }</span>
      <span className="min-w-0 text-base leading-7 text-zinc-900">{ String( value ) }</span>
    </div>
  );
}

export function ProductDetails ( { product, recommendedProducts }: { product: Product; recommendedProducts: Product[] } )
{
  const [ size, setSize ] = useState( product.sizes[ 0 ] );
  const [ color, setColor ] = useState( product.colors[ 0 ] );
  const [ added, setAdded ] = useState( false );
  const [ shareStatus, setShareStatus ] = useState( '' );
  const [ activeImg, setActiveImg ] = useState( 0 );
  const [ activeTab, setActiveTab ] = useState<'details' | 'shipping'>( 'details' );
  const { addToCart, toggleFavorite, favorites, isReady, syncError } = useStore();
  const router = useRouter();
  const resumedAdd = useRef( false );
  const [ addingToBag, setAddingToBag ] = useState( false );

  useEffect( () =>
  {
    trackAnalyticsEvent( 'view_item', {
      currency: 'INR',
      value: product.salePrice || product.price,
      items: [ { item_id: product.sku || product.id, item_name: product.name } ],
    } );
  }, [ product.id, product.name, product.price, product.salePrice, product.sku ] );

  const handleAddToBag = async () =>
  {
    setAddingToBag( true );
    try
    {
      if ( await addToCart( product, size, color ) )
      {
        setAdded( true );
        window.setTimeout( () => setAdded( false ), 1800 );
      }
    } finally
    {
      setAddingToBag( false );
    }
  };

  useEffect( () =>
  {
    if ( !isReady || resumedAdd.current ) return;
    if ( new URLSearchParams( window.location.search ).get( 'resumeAddToBag' ) !== '1' ) return;

    try
    {
      const rawIntent = localStorage.getItem( 'scotland-pending-add-to-bag' );
      if ( !rawIntent ) return;
      const intent = JSON.parse( rawIntent ) as { productId?: string; size?: string; color?: string };
      if ( intent.productId !== product.id || !intent.size || !intent.color ) return;

      resumedAdd.current = true;
      void addToCart( product, intent.size, intent.color ).then( addedToCart =>
      {
        if ( addedToCart )
        {
          localStorage.removeItem( 'scotland-pending-add-to-bag' );
          router.replace( '/cart' );
        }
      } );
    } catch ( error )
    {
      console.error( 'Could not resume the pending add-to-bag action:', error );
    }
  }, [ addToCart, isReady, product, router ] );

  const handleShare = async () =>
  {
    const shareData = {
      title: product.name,
      text: `Check out ${ product.name } on Scotland`,
      url: window.location.href,
    };

    try
    {
      if ( navigator.share )
      {
        await navigator.share( shareData );
        setShareStatus( 'Shared' );
      }
      else
      {
        await navigator.clipboard.writeText( shareData.url );
        setShareStatus( 'Link copied' );
      }
      window.setTimeout( () => setShareStatus( '' ), 1800 );
    }
    catch ( error )
    {
      if ( error instanceof DOMException && error.name === 'AbortError' ) return;
      setShareStatus( 'Try again' );
      window.setTimeout( () => setShareStatus( '' ), 1800 );
    }
  };

  const inventoryVariants = product.inventoryVariants;

  const discount = product.mrp && product.salePrice
    ? Math.round( ( ( product.mrp - product.salePrice ) / product.mrp ) * 100 )
    : product.discount || 0;
  const selectedVariantStock = inventoryVariants?.find( variant => variant.size === size && variant.color === color )?.stockQuantity;

  return (
    <>
      {/* ── Product Detail ── */ }
      <main className="shell py-8 sm:py-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-zinc-500">
          <ol className="flex flex-wrap items-center gap-2">
            <li><a className="hover:text-navy" href="/">Home</a></li>
            <li aria-hidden="true">/</li>
            <li><a className="hover:text-navy" href="/shop">Shop</a></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="max-w-[60vw] truncate text-navy">{ product.name }</li>
          </ol>
        </nav>
        <div className="grid gap-8 lg:grid-cols-5 lg:gap-14">

          {/* ── Images ── */ }
          <div className="lg:col-span-2">
            {/* Main image */ }
            <div className="relative aspect-[.85] w-full overflow-hidden rounded bg-stone">
              <Image
                src={ product.images[ activeImg ] || product.image }
                alt={ activeImg === 0 ? product.image_alt_text || product.name : `${ product.name } product image ${ activeImg + 1 }` }
                fill
                className="object-cover transition-opacity duration-300"
                sizes="(max-width:1024px) 100vw, 40vw"
                priority
                unoptimized={ ( product.images[ activeImg ] || product.image ).startsWith( 'data:' ) }
              />
            </div>
          </div>

          {/* ── Details ── */ }
          <section className="lg:col-span-3 lg:sticky lg:top-20 lg:h-fit space-y-4">
            {/* Product heading */ }
            <p className="text-[11px] uppercase tracking-widest text-zinc-400">
              { product.category }{ product.subcategory ? ` › ${ product.subcategory }` : '' } · { product.gender }
            </p>

            <div className="flex items-start justify-between gap-4">
              <h1 className="display min-w-0 text-3xl leading-tight sm:text-4xl">{ product.name }</h1>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={ handleShare }
                  aria-label="Share product"
                  title={ shareStatus || 'Share product' }
                  className="grid h-10 min-w-10 place-items-center rounded-full border border-stone px-2 text-sm text-navy transition hover:border-navy hover:bg-stone/50"
                >
                  { shareStatus || '↗' }
                </button>
                <button
                  onClick={ () => toggleFavorite( product.id ) }
                  aria-label={ favorites.includes( product.id ) ? 'Remove from wishlist' : 'Add to wishlist' }
                  title={ favorites.includes( product.id ) ? 'Remove from wishlist' : 'Add to wishlist' }
                  className="grid h-10 min-w-10 place-items-center rounded-full border border-stone px-2 text-2xl text-navy transition hover:border-navy hover:bg-stone/50 hover:text-gold"
                >
                  { favorites.includes( product.id ) ? '♥' : '♡' }
                </button>
              </div>
            </div>

            { product.reviews > 0 && product.rating > 0 ? (
              <p className="text-sm text-gold">
                { '★'.repeat( Math.round( product.rating ) ) }{ '☆'.repeat( 5 - Math.round( product.rating ) ) }
                <span className="ml-2 text-xs text-zinc-500">{ product.rating } ({ product.reviews } reviews)</span>
              </p>
            ) : <p className="text-xs text-zinc-500">No reviews yet</p> }

            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-display text-2xl font-semibold text-navy">
                { money( product.salePrice || product.price ) }
              </span>
              { product.mrp && product.mrp > ( product.salePrice || product.price ) && (
                <span className="text-sm text-zinc-400 line-through">{ money( product.mrp ) }</span>
              ) }
              { discount > 0 && <span className="text-sm font-semibold text-red-600">{ discount }% off</span> }
            </div>
            { product.gst && <p className="text-[11px] text-zinc-400">Inclusive of { product.gst } GST</p> }

            { product.shortDescription && (
              <p className="text-sm leading-6 text-zinc-600">{ product.shortDescription }</p>
            ) }

            {/* Colour */ }
            <div>
              <p className="eyebrow mb-2 text-xs">Colour · <span className="font-semibold">{ color }</span></p>
              <div className="flex flex-wrap gap-2">
                { product.colors.map( x => (
                  <button key={ x } onClick={ () => setColor( x ) }
                    className={ `border px-3 py-2 text-xs font-mono transition ${ color === x ? 'border-navy bg-navy text-white' : 'border-stone hover:border-navy' }` }>
                    { x }
                  </button>
                ) ) }
              </div>
            </div>

            {/* Size */ }
            <div>
              <p className="eyebrow mb-2 text-xs">Size · <span className="font-semibold">{ size }</span></p>
              <div className="flex flex-wrap gap-2">
                { product.sizes.map( x => (
                  <button key={ x } onClick={ () => setSize( x ) }
                    className={ `grid h-9 w-9 place-items-center border text-xs font-mono transition ${ size === x ? 'border-navy bg-navy text-white' : 'border-stone hover:border-navy' }` }>
                    { x }
                  </button>
                ) ) }
              </div>
              { product.size_chart && (
                <button onClick={ () => window.open( product.size_chart, '_blank' ) } className="mt-2 text-xs underline text-zinc-500 hover:text-navy">
                  📏 View Size Chart
                </button>
              ) }
            </div>

            {/* Stock status */ }
            { selectedVariantStock !== undefined ? (
              <p className={ `text-xs font-semibold ${ selectedVariantStock > 0 ? selectedVariantStock <= 3 ? 'text-amber-600' : 'text-green-600' : 'text-red-500' }` }>
                { selectedVariantStock > 0 ? `${ selectedVariantStock } available in this size and color` : 'Out of stock in this size and color' }
              </p>
            ) : product.stock_status && (
              <p className={ `text-xs font-semibold ${ product.stock_status === 'in_stock' ? 'text-green-600' : product.stock_status === 'out_of_stock' ? 'text-red-500' : 'text-amber-500' }` }>
                { product.stock_status === 'in_stock' ? '✅ In Stock' : product.stock_status === 'out_of_stock' ? '❌ Out of Stock' : '🔔 Pre-Order' }
              </p>
            ) }

            {/* Not Available Banner */ }
            { product.status === 'draft' && (
              <div className="rounded-lg border-2 border-red-500 bg-red-50 px-5 py-4 text-center">
                <p className="text-sm font-bold uppercase tracking-widest text-red-600">⚠ Product Not Available</p>
                <p className="mt-1 text-xs text-red-400">This item is currently unavailable. Check back soon.</p>
              </div>
            ) }

            {/* Add to bag */ }
            <button
              onClick={ handleAddToBag }
              className="button w-full disabled:opacity-40 disabled:cursor-not-allowed"
              type="button"
              disabled={ !isReady || addingToBag || product.status === 'draft' || selectedVariantStock === 0 }
            >
              { product.status === 'draft' ? '🚫 Not Available' : addingToBag ? 'Saving to your bag…' : added ? '✓ Added to bag' : 'Add to bag' }
            </button>
            { syncError && <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{ syncError }</p> }

            {/* COD */ }
            { product.cod !== undefined && (
              <p className="text-[11px] text-zinc-500">
                { product.cod ? '🚚 Cash on Delivery available' : '🚫 COD not available' }
              </p>
            ) }
            {/* ── Tabs: Product Details / Shipping / Reviews ── */ }
            <div className="mt-12 border-t border-stone/70 pt-8 sm:mt-14">
              {/* Tab headers */ }
              <div className="flex overflow-x-auto rounded-xl border border-stone/80 bg-white/50 p-1 shadow-sm">
                { ( [ 'details', 'shipping' ] as const ).map( tab => (
                  <button key={ tab } onClick={ () => setActiveTab( tab ) }
                    aria-pressed={ activeTab === tab }
                    className={ `flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 py-3 text-xs font-bold uppercase tracking-[.1em] transition sm:flex-1 sm:justify-center sm:px-5 ${ activeTab === tab ? 'bg-navy text-white shadow-sm' : 'text-zinc-500 hover:bg-stone/60 hover:text-navy' }` }>
                    <span aria-hidden="true">{ tab === 'details' ? '▤' : '▣' }</span>
                    { tab === 'details' ? 'Product Details' : 'Shipping' }
                  </button>
                ) ) }
              </div>

              {/* Tab content */ }
              <div className="mt-5 rounded-xl border border-stone/70 bg-white/35 px-4 py-5 sm:px-6 sm:py-7">
                { activeTab === 'details' && (
                  <div className="grid max-w-5xl gap-0">
                    <DetailRow label="Description" value={ product.description } />
                    <DetailRow label="Category" value={ product.category } />
                    <DetailRow label="Subcategory" value={ product.subcategory } />
                    <DetailRow label="Gender" value={ product.gender } />
                    <DetailRow label="Fabric" value={ product.fabric } />
                    <DetailRow label="Material" value={ product.material } />
                    <DetailRow label="Fit" value={ product.fit } />
                    <DetailRow label="Pattern" value={ product.pattern } />
                    <DetailRow label="Sleeve" value={ product.sleeve } />
                    <DetailRow label="Collar" value={ product.collar } />
                    <DetailRow label="Occasion" value={ product.occasion } />
                    <DetailRow label="Season" value={ product.season } />
                    <DetailRow label="SKU" value={ product.id } />
                    { product.tags && product.tags.length > 0 && (
                      <div className="flex gap-5 border-b border-stone/60 py-4 sm:gap-8">
                        <span className="w-28 shrink-0 text-sm font-medium uppercase tracking-wide text-zinc-500 sm:w-40">Tags</span>
                        <div className="flex flex-wrap gap-1">
                          { product.tags.map( t => (
                            <span key={ t } className="rounded-full bg-stone/60 px-3 py-1 text-xs text-zinc-700">{ t }</span>
                          ) ) }
                        </div>
                      </div>
                    ) }
                  </div>
                ) }

                { activeTab === 'shipping' && (
                  <div className="max-w-5xl">
                    <div className="mb-6 grid gap-3 sm:grid-cols-2">
                      <div className="flex gap-3 rounded-lg border border-stone/70 bg-white/50 p-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-stone text-lg" aria-hidden="true">🚚</span>
                        <div>
                          <p className="text-sm font-semibold text-navy">Delivery</p>
                          <p className="mt-1 text-sm leading-6 text-zinc-500">Standard delivery in 3–7 business days.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 rounded-lg border border-stone/70 bg-white/50 p-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-stone text-lg" aria-hidden="true">💳</span>
                        <div>
                          <p className="text-sm font-semibold text-navy">Cash on Delivery</p>
                          <p className="mt-1 text-sm leading-6 text-zinc-500">{ product.cod ? 'Available for this product.' : 'Not available for this product.' }</p>
                        </div>
                      </div>
                    </div>
                    <DetailRow label="Weight" value={ product.weight } />
                    <DetailRow label="Dimensions" value={ product.dimensions } />
                    <DetailRow label="GST" value={ product.gst } />
                    <p className="mt-6 border-t border-stone/60 pt-5 text-sm leading-7 text-zinc-500">📦 Express delivery is also available at checkout.</p>
                  </div>
                ) }

              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ── You May Also Like ── */ }
      { recommendedProducts.length > 0 && (
        <section className="border-t border-stone bg-[#f9f7f4] py-12">
          <div className="shell">
            <h2 className="display text-2xl mb-8 text-center tracking-wide uppercase text-navy">
              You may also like
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              { recommendedProducts.map( p => (
                <ProductCard key={ p.id } product={ p } />
              ) ) }
            </div>
          </div>
        </section>
      ) }
    </>
  );
}
