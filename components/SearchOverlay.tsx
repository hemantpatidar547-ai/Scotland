'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export function SearchOverlay ( {
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
} )
{
    const [ searchQuery, setSearchQuery ] = useState( '' );
    const [ products, setProducts ] = useState<any[]>( [] );
    const [ filteredProducts, setFilteredProducts ] = useState<any[]>( [] );
    const [ loading, setLoading ] = useState( false );
    const inputRef = useRef<HTMLInputElement>( null );

    // Fetch products once when mounted, optionally cache them
    useEffect( () =>
    {
        if ( isOpen )
        {
            inputRef.current?.focus();
            if ( products.length === 0 )
            {
                setLoading( true );
                fetch( '/api/products' )
                    .then( ( res ) => res.json() )
                    .then( ( data ) =>
                    {
                        if ( data && data.data )
                        {
                            setProducts( data.data );
                        }
                        setLoading( false );
                    } )
                    .catch( ( err ) =>
                    {
                        console.error( 'Failed to fetch products', err );
                        setLoading( false );
                    } );
            }
        } else
        {
            // Reset search query when closed
            setSearchQuery( '' );
            setFilteredProducts( [] );
        }
    }, [ isOpen ] );

    useEffect( () =>
    {
        if ( searchQuery.trim() === '' )
        {
            setFilteredProducts( [] );
        } else
        {
            const query = searchQuery.toLowerCase();
            const results = products.filter( ( p ) =>
            {
                return (
                    p.name?.toLowerCase().includes( query ) ||
                    p.category?.toLowerCase().includes( query ) ||
                    p.description?.toLowerCase().includes( query )
                );
            } );
            setFilteredProducts( results );
        }
    }, [ searchQuery, products ] );

    // Handle escape key
    useEffect( () =>
    {
        const handleKeyDown = ( e: KeyboardEvent ) =>
        {
            if ( e.key === 'Escape' && isOpen )
            {
                onClose();
            }
        };
        document.addEventListener( 'keydown', handleKeyDown );
        return () => document.removeEventListener( 'keydown', handleKeyDown );
    }, [ isOpen, onClose ] );

    if ( !isOpen ) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-cream/95 backdrop-blur-sm animate-in fade-in duration-300">
            {/* Top Search Bar area */ }
            <div className="shell flex items-center min-h-[68px] sm:min-h-[84px] border-b border-stone py-2 sm:py-0 relative">
                <div className="flex-1 flex items-center gap-2 sm:gap-4 min-w-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 sm:h-6 sm:w-6 text-navy/70 shrink-0">
                        <circle cx="11" cy="11" r="6.5" />
                        <path d="m16 16 4 4" />
                    </svg>
                    <input
                        ref={ inputRef }
                        type="text"
                        placeholder="Search products..."
                        value={ searchQuery }
                        onChange={ ( e ) => setSearchQuery( e.target.value ) }
                        className="w-full min-w-0 bg-transparent text-lg sm:text-xl md:text-2xl outline-none placeholder:text-stone font-display text-navy"
                    />
                </div>
                <button
                    onClick={ onClose }
                    className="ml-2 sm:ml-4 shrink-0 text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-navy border border-stone px-3 py-1.5 sm:px-4 sm:py-2 hover:bg-stone/10 transition"
                >
                    Close
                </button>
            </div>

            {/* Results Area */ }
            <div className="shell flex-1 overflow-y-auto py-10">
                { searchQuery.trim().length === 0 ? (
                    <div className="text-center text-zinc-500 mt-20">
                        <p className="text-sm font-semibold uppercase tracking-widest mb-3">Popular Searches</p>
                        <div className="flex flex-wrap justify-center gap-3">
                            <button onClick={ () => setSearchQuery( 'T-Shirt' ) } className="border border-stone px-4 py-1.5 rounded-full text-xs hover:border-navy transition">Premium T-Shirts</button>
                            <button onClick={ () => setSearchQuery( 'Combo' ) } className="border border-stone px-4 py-1.5 rounded-full text-xs hover:border-navy transition">Combos</button>
                            <button onClick={ () => setSearchQuery( 'Black' ) } className="border border-stone px-4 py-1.5 rounded-full text-xs hover:border-navy transition">Black Editions</button>
                        </div>
                    </div>
                ) : loading ? (
                    <div className="text-center text-zinc-500 mt-20 text-sm tracking-widest uppercase">
                        Searching products...
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="text-center text-zinc-500 mt-20">
                        <p className="text-lg font-display text-navy">No results found for "{ searchQuery }"</p>
                        <p className="text-sm mt-2">Try checking your spelling or use different keywords.</p>
                    </div>
                ) : (
                    <div>
                        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-6 font-semibold">
                            Found { filteredProducts.length } result{ filteredProducts.length !== 1 ? 's' : '' }
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                            { filteredProducts.map( ( product ) => (
                                <Link
                                    key={ product.id || product._id }
                                    href={ `/product/${ product.slug || product.id }` }
                                    onClick={ onClose }
                                    className="group block"
                                >
                                    <div className="aspect-[3/4] bg-stone relative overflow-hidden mb-2 sm:mb-3">
                                        <img
                                            src={ product.images?.[ 0 ] || product.image || '/images/placeholder.jpg' }
                                            alt={ product.name }
                                            className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                                        />
                                    </div>
                                    <h3 className="font-semibold text-navy text-[11px] sm:text-xs md:text-sm mb-0.5 sm:mb-1 line-clamp-1">{ product.name }</h3>
                                    <p className="text-zinc-600 text-[10px] sm:text-xs">
                                        ₹{ product.price }
                                        { product.compareAtPrice && (
                                            <span className="line-through text-stone ml-1.5 sm:ml-2 font-light">₹{ product.compareAtPrice }</span>
                                        ) }
                                    </p>
                                </Link>
                            ) ) }
                        </div>
                    </div>
                ) }
            </div>
        </div>
    );
}
