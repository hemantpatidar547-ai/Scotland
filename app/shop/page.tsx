'use client';
import { useState, useEffect, useMemo } from 'react';
import { ProductCard } from '@/components/ProductCard';
import { Product } from '@/types/product';

export default function Shop ()
{
  const [ query, setQuery ] = useState( '' );
  const [ products, setProducts ] = useState<Product[]>( [] );
  const [ loading, setLoading ] = useState( true );

  useEffect( () =>
  {
    fetch( '/api/products', { cache: 'no-store' } )
      .then( res => res.json() )
      .then( d =>
      {
        setProducts( d.data );
        setLoading( false );
      } )
      .catch( e =>
      {
        console.error( e );
        setLoading( false );
      } );
  }, [] );

  const items = useMemo( () =>
    products.filter( p =>
      p.name?.toLowerCase().includes( query.toLowerCase() )
    ),
    [ query, products ]
  );

  return (
    <main className="bg-stone/5 min-h-screen">
      {/* Header Section */ }
      <div className="bg-white border-b border-stone">
        <div className="shell py-16 text-center">
          <p className="eyebrow text-navy">The full collection</p>
          <h1 className="display mt-3 text-6xl font-serif">Shop all pieces</h1>
          <p className="mt-5 max-w-2xl mx-auto text-lg text-zinc-600 leading-relaxed">
            Scottish character, Italian tailoring, Korean minimalism and Japanese workwear. Refined everyday pieces designed for life's best moments.
          </p>
        </div>
      </div>

      {/* Search Section */ }
      <div className="shell py-8">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <input
              className="w-full px-6 py-4 border-2 border-navy/10 focus:border-navy focus:outline-none text-lg rounded-lg bg-white transition placeholder-zinc-400"
              value={ query }
              onChange={ e => setQuery( e.target.value ) }
              placeholder="Search pieces..."
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-navy/30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 } d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */ }
      <div className="shell pb-20">
        { loading ? (
          <div className="text-center py-16 text-zinc-500">Loading pieces...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            { items.length > 0 ? (
              items.map( product => (
                <div key={ product.id } className="group">
                  <ProductCard product={ product } />
                </div>
              ) )
            ) : (
              <div className="col-span-full text-center py-16">
                <p className="text-zinc-400 text-lg">No pieces found matching "{ query }"</p>
                <button
                  onClick={ () => setQuery( '' ) }
                  className="mt-4 text-navy underline hover:no-underline"
                >
                  Clear search
                </button>
              </div>
            ) }
          </div>
        ) }
      </div>
    </main>
  );
}
