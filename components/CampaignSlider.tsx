'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const campaigns = [
    {
        id: 1,
        collection: "THE COASTAL ESCAPE",
        image: '/images/hero/coastal-yacht.jpeg',
        title: "MADE FOR",
        titleLine2: "THE OPEN WATER",
        subtitle: "Relaxed tailoring and breathable layers for bright horizons, salt air and slow departures.",
        link: "/shop",
        buttonText: "SHOP THE ESCAPE",
        objectPosition: "object-center"
    },
    {
        id: 2,
        collection: "THE WEEKEND EDIT",
        image: '/images/hero/mountain-drive.jpeg',
        title: "DRESS FOR",
        titleLine2: "THE WAY OUT",
        subtitle: "Easy layers and considered essentials for open roads, mountain air, and unplanned detours.",
        link: "/shop",
        buttonText: "SHOP THE WEEKEND",
        objectPosition: "object-center"
    },
    {
        id: 3,
        collection: "THE CITY ESCAPE",
        image: '/images/hero/scooter-escape.jpeg',
        title: "TAKE THE",
        titleLine2: "SCENIC ROUTE",
        subtitle: "Light layers and relaxed tailoring for slow mornings, warm streets, and the long way home.",
        link: "/shop",
        buttonText: "SHOP THE ESCAPE",
        objectPosition: "object-center"
    }
];

const SLIDE_DURATION = 5000;

export function CampaignSlider ()
{
    const [ currentIndex, setCurrentIndex ] = useState( 0 );
    const [ progress, setProgress ] = useState( 0 );
    const [ isAnimating, setIsAnimating ] = useState( false );
    const [ prevIndex, setPrevIndex ] = useState<number | null>( null );

    const goToSlide = useCallback( ( index: number ) =>
    {
        if ( index === currentIndex || isAnimating ) return;
        setIsAnimating( true );
        setPrevIndex( currentIndex );
        setCurrentIndex( index );
        setProgress( 0 );
        setTimeout( () =>
        {
            setIsAnimating( false );
            setPrevIndex( null );
        }, 900 );
    }, [ currentIndex, isAnimating ] );

    const goNext = useCallback( () =>
    {
        goToSlide( ( currentIndex + 1 ) % campaigns.length );
    }, [ currentIndex, goToSlide ] );

    const goPrev = useCallback( () =>
    {
        goToSlide( ( currentIndex - 1 + campaigns.length ) % campaigns.length );
    }, [ currentIndex, goToSlide ] );

    // Auto-advance with progress tracking
    useEffect( () =>
    {
        setProgress( 0 );
        const startTime = Date.now();

        const progressInterval = setInterval( () =>
        {
            const elapsed = Date.now() - startTime;
            const pct = Math.min( ( elapsed / SLIDE_DURATION ) * 100, 100 );
            setProgress( pct );
        }, 30 );

        const timer = setTimeout( () =>
        {
            setCurrentIndex( prev => ( prev + 1 ) % campaigns.length );
            setProgress( 0 );
        }, SLIDE_DURATION );

        return () =>
        {
            clearInterval( progressInterval );
            clearTimeout( timer );
        };
    }, [ currentIndex ] );

    const padNum = ( n: number ) => String( n + 1 ).padStart( 2, '0' );

    return (
        <section className="relative w-full h-[72vh] min-h-[500px] max-h-[700px] overflow-hidden bg-black">

            {/* ── SLIDES ── */ }
            { campaigns.map( ( camp, index ) =>
            {
                const isActive = index === currentIndex;
                const isPrev = index === prevIndex;

                return (
                    <div
                        key={ camp.id }
                        className="absolute inset-0"
                        style={ {
                            zIndex: isActive ? 10 : isPrev ? 9 : 0,
                            opacity: isActive ? 1 : 0,
                            transition: 'opacity 0.9s cubic-bezier(0.4,0,0.2,1)',
                            pointerEvents: isActive ? 'auto' : 'none',
                        } }
                    >
                        {/* Background image with Ken Burns zoom */ }
                        <div
                            className="absolute inset-0"
                            style={ {
                                transform: isActive ? 'scale(1.06)' : 'scale(1)',
                                transition: isActive
                                    ? `transform ${ SLIDE_DURATION + 500 }ms cubic-bezier(0.25,0.46,0.45,0.94)`
                                    : 'transform 0.9s ease',
                            } }
                        >
                            <Image
                                src={ camp.image }
                                alt={ camp.title }
                                fill
                                className={ `object-contain ${ camp.objectPosition }` }
                                sizes="100vw"
                                priority={ index === 0 }
                            />
                        </div>

                        {/* Gradient overlay — left-heavy for text readability */ }
                        <div
                            className="absolute inset-0"
                            style={ {
                                background: 'linear-gradient(105deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.38) 50%, rgba(0,0,0,0.10) 100%)',
                            } }
                        />

                        {/* ── CONTENT (left-aligned editorial) ── */ }
                        <div className="absolute inset-0 flex flex-col justify-end pb-12 px-6 sm:px-12 sm:pb-16 lg:px-20">
                            {/* Collection label */ }
                            <div
                                style={ {
                                    opacity: isActive ? 1 : 0,
                                    transform: isActive ? 'translateY(0)' : 'translateY(20px)',
                                    transition: 'opacity 0.7s ease 0.2s, transform 0.7s ease 0.2s',
                                } }
                            >
                                <span
                                    className="inline-block text-xs tracking-[0.35em] text-white/70 uppercase font-light mb-5"
                                    style={ { letterSpacing: '0.3em' } }
                                >
                                    — { camp.collection }
                                </span>
                            </div>

                            {/* Main headline */ }
                            <h2
                                className="font-display text-white leading-none"
                                style={ {
                                    fontSize: 'clamp(2.5rem, 5vw, 4.75rem)',
                                    lineHeight: '0.98',
                                    letterSpacing: '0',
                                    opacity: isActive ? 1 : 0,
                                    transform: isActive ? 'translateY(0)' : 'translateY(30px)',
                                    transition: 'opacity 0.8s ease 0.35s, transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.35s',
                                } }
                            >
                                { camp.title }
                            </h2>
                            <h2
                                className="font-display text-white leading-none"
                                style={ {
                                    fontSize: 'clamp(2.75rem, 5.5vw, 5.25rem)',
                                    lineHeight: '0.98',
                                    letterSpacing: '0',
                                    opacity: isActive ? 1 : 0,
                                    transform: isActive ? 'translateY(0)' : 'translateY(40px)',
                                    transition: 'opacity 0.8s ease 0.5s, transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.5s',
                                    marginBottom: '1.5rem',
                                } }
                            >
                                { camp.titleLine2 }
                            </h2>

                            {/* Thin divider */ }
                            <div
                                style={ {
                                    width: isActive ? '4rem' : '0',
                                    height: '1px',
                                    background: 'rgba(255,255,255,0.5)',
                                    marginBottom: '1.25rem',
                                    transition: 'width 0.6s ease 0.65s',
                                } }
                            />

                            {/* Subtitle */ }
                            <p
                                className="text-sm sm:text-base text-white/70 font-light max-w-sm leading-relaxed"
                                style={ {
                                    opacity: isActive ? 1 : 0,
                                    transform: isActive ? 'translateY(0)' : 'translateY(20px)',
                                    transition: 'opacity 0.7s ease 0.7s, transform 0.7s ease 0.7s',
                                    marginBottom: '2rem',
                                } }
                            >
                                { camp.subtitle }
                            </p>

                            {/* CTA button */ }
                            <div
                                style={ {
                                    opacity: isActive ? 1 : 0,
                                    transform: isActive ? 'translateY(0)' : 'translateY(20px)',
                                    transition: 'opacity 0.7s ease 0.85s, transform 0.7s ease 0.85s',
                                } }
                            >
                                <Link
                                    href={ camp.link }
                                    className="group inline-flex items-center gap-3 text-xs tracking-[0.25em] uppercase text-white font-medium"
                                >
                                    <span className="border-b border-white/60 pb-0.5 group-hover:border-white transition-colors duration-300">
                                        { camp.buttonText }
                                    </span>
                                    <svg
                                        width="24" height="10" viewBox="0 0 24 10" fill="none"
                                        className="transform group-hover:translate-x-1.5 transition-transform duration-300"
                                    >
                                        <path d="M0 5H22M18 1L22 5L18 9" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </Link>
                            </div>
                        </div>
                    </div>
                );
            } ) }

            {/* ── SLIDE COUNTER (top-right) ── */ }
            <div className="absolute top-8 right-8 sm:right-12 z-20 text-white/60 text-xs tracking-widest font-light">
                <span className="text-white font-medium text-sm">{ padNum( currentIndex ) }</span>
                <span className="mx-1">/</span>
                <span>{ padNum( campaigns.length - 1 ) }</span>
            </div>

            {/* ── BRAND WORDMARK (top-left) ── */ }
            <div className="absolute top-0 left-0 z-20 px-8 sm:px-16 lg:px-24 py-8">
                <span className="text-white/30 text-xs tracking-[0.4em] uppercase font-light">Scotland</span>
            </div>

            {/* ── ARROW NAVIGATION ── */ }
            <button
                onClick={ goPrev }
                className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center border border-white/25 text-white/60 hover:border-white hover:text-white transition-all duration-300 group"
                aria-label="Previous slide"
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="group-hover:-translate-x-0.5 transition-transform duration-200">
                    <path d="M10 2L4 8L10 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            <button
                onClick={ goNext }
                className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center border border-white/25 text-white/60 hover:border-white hover:text-white transition-all duration-300 group"
                aria-label="Next slide"
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="group-hover:translate-x-0.5 transition-transform duration-200">
                    <path d="M6 2L12 8L6 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {/* ── BOTTOM BAR: Progress + Slide Dots ── */ }
            <div className="absolute bottom-0 left-0 right-0 z-20 flex items-end justify-between px-8 sm:px-16 lg:px-24 pb-8">

                {/* Slide pills */ }
                <div className="flex items-center gap-2">
                    { campaigns.map( ( _, index ) => (
                        <button
                            key={ index }
                            onClick={ () => goToSlide( index ) }
                            aria-label={ `Go to slide ${ index + 1 }` }
                            className="relative overflow-hidden"
                            style={ {
                                width: index === currentIndex ? '2.5rem' : '0.5rem',
                                height: '2px',
                                background: index === currentIndex ? 'transparent' : 'rgba(255,255,255,0.3)',
                                transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
                            } }
                        >
                            {/* Animated fill for active dot */ }
                            { index === currentIndex && (
                                <span
                                    className="absolute inset-0 bg-white origin-left"
                                    style={ {
                                        transform: `scaleX(${ progress / 100 })`,
                                        transition: 'transform 0.03s linear',
                                    } }
                                />
                            ) }
                        </button>
                    ) ) }
                </div>

                {/* Scroll indicator */ }
                <div className="hidden sm:flex flex-col items-center gap-1.5 text-white/30">
                    <div className="w-px h-8 bg-white/20 relative overflow-hidden">
                        <div
                            className="absolute top-0 left-0 right-0 bg-white/50"
                            style={ {
                                height: `${ progress }%`,
                                transition: 'height 0.03s linear',
                            } }
                        />
                    </div>
                    <span className="text-[9px] tracking-[0.3em] uppercase rotate-0">Scroll</span>
                </div>
            </div>
        </section>
    );
}
