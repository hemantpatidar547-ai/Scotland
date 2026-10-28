'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navigation = [
    {
        label: 'WORKSPACE',
        links: [
            { href: '/admin', label: 'Overview', exact: true },
            { href: '/admin/orders', label: 'Orders' },
            { href: '/admin/courier', label: 'Courier & billing' },
            { href: '/admin/customers', label: 'Customers' },
        ],
    },
    {
        label: 'CATALOG',
        links: [
            { href: '/admin/products', label: 'Products' },
            { href: '/admin/categories', label: 'Categories' },
        ],
    },
    {
        label: 'STORE',
        links: [
            { href: '/admin/coupons', label: 'Coupons & offers' },
            { href: '/admin/homepage', label: 'Homepage content' },
            { href: '/admin/seo', label: 'SEO & Google' },
        ],
    },
];

export default function AdminNavigation ()
{
    const pathname = usePathname();
    const [ open, setOpen ] = useState( false );

    useEffect( () =>
    {
        setOpen( false );
    }, [ pathname ] );

    useEffect( () =>
    {
        if ( !open ) return;
        const closeOnEscape = ( event: KeyboardEvent ) =>
        {
            if ( event.key === 'Escape' ) setOpen( false );
        };
        document.addEventListener( 'keydown', closeOnEscape );
        document.body.style.overflow = 'hidden';
        return () =>
        {
            document.removeEventListener( 'keydown', closeOnEscape );
            document.body.style.overflow = '';
        };
    }, [ open ] );

    function isActive ( href: string, exact?: boolean )
    {
        return exact ? pathname === href : pathname === href || pathname.startsWith( `${ href }/` );
    }

    return <>
        <button
            type="button"
            aria-label={ open ? 'Close admin menu' : 'Open admin menu' }
            aria-expanded={ open }
            aria-controls="admin-navigation-drawer"
            onClick={ () => setOpen( current => !current ) }
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-stone bg-white text-navy transition hover:bg-stone/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
        >
            { open ? (
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
                    <path d="m6 6 12 12M18 6 6 18" />
                </svg>
            ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            ) }
        </button>

        { open && <>
            <button
                type="button"
                aria-label="Close admin menu"
                onClick={ () => setOpen( false ) }
                className="fixed inset-x-0 bottom-0 top-16 z-[60] cursor-default bg-navy/35"
            />
            <aside
                id="admin-navigation-drawer"
                aria-label="Admin navigation"
                className="fixed bottom-0 left-0 top-16 z-[70] flex w-[min(20rem,88vw)] flex-col overflow-y-auto border-r border-stone bg-white p-4 shadow-2xl"
            >
                <div className="mb-6 rounded-lg bg-navy p-4 text-white">
                    <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-stone/70">Store workspace</p>
                    <p className="mt-1 text-sm font-semibold">Owner access</p>
                </div>
                <div className="space-y-6">
                    { navigation.map( group => <div key={ group.label }>
                        <p className="mb-2 px-3 text-[10px] font-semibold tracking-[.14em] text-zinc-400">{ group.label }</p>
                        <div className="space-y-1">
                            { group.links.map( link =>
                            {
                                const active = isActive( link.href, 'exact' in link ? link.exact : false );
                                return <Link
                                    key={ link.href }
                                    href={ link.href }
                                    aria-current={ active ? 'page' : undefined }
                                    onClick={ () => setOpen( false ) }
                                    className={ `flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition ${
                                        active ? 'bg-navy text-white shadow-sm' : 'text-zinc-600 hover:bg-stone/50 hover:text-navy'
                                    }` }
                                >
                                    { link.label }
                                </Link>;
                            } ) }
                        </div>
                    </div> ) }
                </div>
                <div className="mt-auto border-t border-stone pt-4">
                    <Link
                        href="/"
                        onClick={ () => setOpen( false ) }
                        className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-zinc-600 hover:bg-stone/50 hover:text-navy"
                    >
                        View live storefront
                    </Link>
                </div>
            </aside>
        </> }
    </>;
}
