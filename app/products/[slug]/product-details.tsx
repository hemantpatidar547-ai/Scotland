'use client';
import Image from 'next/image';
import { useState } from 'react';
import { Product } from '@/types/product';
import { useStore } from '@/components/StoreProvider';

const money = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

export function ProductDetails({ product }: { product: Product }) {
  const [size, setSize] = useState(product.sizes[0]);
  const [color, setColor] = useState(product.colors[0]);
  const [added, setAdded] = useState(false);
  const { addToCart, toggleFavorite, favorites } = useStore();

  const handleAddToBag = () => {
    addToCart(product, size, color);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <main className="shell py-8 sm:py-12">
      <div className="grid gap-6 lg:grid-cols-5 lg:gap-12">
        {/* Images Column */}
        <div className="grid w-full max-w-[520px] justify-self-center gap-2 sm:grid-cols-2 lg:col-span-2 lg:flex lg:min-h-[650px] lg:w-full lg:max-w-none lg:items-center lg:justify-center">
          {product.images.map((src, i) => (
            <div key={src} className="relative aspect-[.8] w-full overflow-hidden rounded-sm bg-stone lg:max-w-[420px]">
              <Image
                src={src}
                alt={`${product.name} ${i + 1}`}
                fill
                className="object-cover"
                sizes="(max-width:1024px) 100vw, 40vw"
                priority={i === 0}
                unoptimized={src.startsWith('data:')}
              />
            </div>
          ))}
        </div>

        {/* Details Column */}
        <section className="lg:col-span-3 lg:sticky lg:top-20 lg:h-fit">
          <p className="eyebrow text-zinc-500 text-xs tracking-widest">
            {product.category} · {product.gender}
          </p>

          <div className="mt-2 flex items-start justify-between">
            <h1 className="display min-w-0 text-3xl leading-tight sm:text-4xl">{product.name}</h1>
            <button
              onClick={() => toggleFavorite(product.id)}
              className="ml-3 shrink-0 p-1 text-2xl"
            >
              {favorites.includes(product.id) ? '♥' : '♡'}
            </button>
          </div>

          <p className="mt-2 text-lg font-display">{money(product.salePrice || product.price)}</p>
          <p className="mt-2 text-sm text-gold">
            ★ {product.rating} <span className="text-zinc-500">({product.reviews} reviews)</span>
          </p>

          <p className="mt-5 leading-7 text-zinc-600 text-sm">{product.description}</p>

          <div className="mt-6">
            <p className="eyebrow mb-2 text-xs">Colour · {color}</p>
            <div className="flex gap-2">
              {product.colors.map((x) => (
                <button
                  key={x}
                  onClick={() => setColor(x)}
                  className={`border px-3 py-2 text-xs font-mono transition ${
                    color === x
                      ? 'border-navy bg-navy text-white'
                      : 'border-stone hover:border-navy'
                  }`}
                >
                  {x}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="eyebrow mb-2 text-xs">Size · {size}</p>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((x) => (
                <button
                  key={x}
                  onClick={() => setSize(x)}
                  className={`grid h-9 w-9 place-items-center border text-xs font-mono transition ${
                    size === x
                      ? 'border-navy bg-navy text-white'
                      : 'border-stone hover:border-navy'
                  }`}
                >
                  {x}
                </button>
              ))}
            </div>
            <button className="mt-2 text-xs underline text-zinc-600 hover:text-navy">
              Size guide
            </button>
          </div>

          <button onClick={handleAddToBag} className="button mt-7 w-full" type="button">
            {added ? 'Added to bag' : 'Add to bag'}
          </button>
        </section>
      </div>
    </main>
  );
}
