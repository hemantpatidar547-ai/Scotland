'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useStore } from './StoreProvider';
import { SearchOverlay } from './SearchOverlay';

const navItems = [
  [ 'Home', '/' ], [ 'Shop', '/shop' ], [ 'About us', '/about' ], [ 'Contact', '/contact' ],
];

function SearchIcon () { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>; }
function AccountIcon () { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="8" r="3.8" /><path d="M4.5 21c.8-4 3.2-6 7.5-6s6.7 2 7.5 6" /></svg>; }
function BagIcon () { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 8.5h16l-1.1 12H5.1L4 8.5Z" /><path d="M8.5 9V6a3.5 3.5 0 0 1 7 0v3" /></svg>; }
function MenuIcon ( { open }: { open: boolean } )
{
  return open
    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
}

export function Header ()
{
  const [ open, setOpen ] = useState( false );
  const [ isSearchOpen, setIsSearchOpen ] = useState( false );
  const pathname = usePathname();
  const { cart } = useStore();
  const count = cart.reduce( ( total, item ) => total + item.quantity, 0 );

  return <>
    <div className="flex min-h-8 items-center justify-center bg-navy px-3 py-1 text-center text-[9px] uppercase tracking-[.08em] text-white sm:text-[10px] sm:tracking-[.1em]">Free shipping on orders above ₹4,000 <span className="ml-1 hidden text-gold sm:inline">• Easy 14-day returns</span></div>
    <header className="sticky top-0 z-30 border-b border-stone bg-cream/95 backdrop-blur">
      <div className="shell relative flex h-[68px] items-center justify-between gap-2 sm:h-[84px] sm:gap-5">
        <Link href="/" className="flex min-w-0 items-center gap-1.5 text-navy sm:gap-2.5" aria-label="SCOTLAND home">
          <img src="/images/brand/scotland-lion.png" alt="" className="h-10 w-7 shrink-0 object-contain mix-blend-multiply sm:h-14 sm:w-11" />
          <span className="whitespace-nowrap font-display text-[1.05rem] font-semibold tracking-[.1em] sm:text-3xl sm:tracking-[.16em]">SCOTLAND</span>
        </Link>
        <nav className="hidden h-full items-center gap-11 lg:absolute lg:left-1/2 lg:flex lg:-translate-x-1/2" aria-label="Primary navigation">
          { navItems.map( ( [ name, href ] ) => <Link key={ name } href={ href } className={ `relative flex h-full items-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-[.1em] transition hover:text-gold ${ pathname === href ? 'text-gold after:absolute after:bottom-[17px] after:left-0 after:right-0 after:h-[2px] after:bg-gold' : 'text-navy' }` }>{ name }</Link> ) }
        </nav>
        <div className="flex shrink-0 items-center justify-end gap-1.5 border-navy/15 text-navy sm:gap-3 lg:border-l lg:ml-6 lg:pl-6">
          <button className="grid h-10 w-7 shrink-0 place-items-center [&>svg]:h-5 [&>svg]:w-5 lg:hidden" onClick={ () => setOpen( !open ) } aria-label="Toggle menu" aria-expanded={ open }><MenuIcon open={ open } /></button>
          <button onClick={ () => setIsSearchOpen( true ) } className="grid h-8 w-6 shrink-0 place-items-center [&>svg]:h-5 [&>svg]:w-5 hover:text-gold transition sm:w-7" aria-label="Search products"><SearchIcon /></button>
          <Link href="/account" className="grid h-8 w-6 shrink-0 place-items-center [&>svg]:h-5 [&>svg]:w-5 sm:w-7" aria-label="Account"><AccountIcon /></Link>
          <Link href="/cart" className="relative grid h-8 w-6 shrink-0 place-items-center [&>svg]:h-5 [&>svg]:w-5 sm:w-7" aria-label={ `Shopping bag${ count ? `, ${ count } items` : '' }` }><BagIcon />{ count > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[8px] font-bold text-white">{ count }</span> }</Link>
        </div>
      </div>
      { open && <nav className="border-t border-stone bg-cream px-5 py-3 lg:hidden">{ navItems.map( ( [ name, href ] ) => <Link onClick={ () => setOpen( false ) } className={ `block py-3 text-xs font-semibold uppercase tracking-widest ${ pathname === href ? 'text-gold' : 'text-navy' }` } key={ name } href={ href }>{ name }</Link> ) }</nav> }
    </header>
    <SearchOverlay isOpen={ isSearchOpen } onClose={ () => setIsSearchOpen( false ) } />
  </>;
}
