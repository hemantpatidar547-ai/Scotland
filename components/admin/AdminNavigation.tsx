'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

    function isActive ( href: string, exact?: boolean )
    {
        return exact ? pathname === href : pathname === href || pathname.startsWith( `${ href }/` );
    }

    return <>
        <nav aria-label="Admin navigation" className="hidden w-64 shrink-0 border-r border-stone bg-white lg:block">
            <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col overflow-y-auto p-4">
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
                                    className={ `flex min-h-10 items-center rounded-md px-3 text-sm font-medium transition ${
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
                    <Link href="/" className="flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-zinc-600 hover:bg-stone/50 hover:text-navy">
                        View live storefront
                    </Link>
                </div>
            </div>
        </nav>

        <nav aria-label="Admin navigation" className="border-b border-stone bg-white lg:hidden">
            <div className="flex gap-2 overflow-x-auto px-4 py-2">
                { navigation.flatMap( group => group.links ).map( link =>
                {
                    const active = isActive( link.href, 'exact' in link ? link.exact : false );
                    return <Link
                        key={ link.href }
                        href={ link.href }
                        aria-current={ active ? 'page' : undefined }
                        className={ `shrink-0 rounded-full px-3 py-2 text-xs font-medium ${
                            active ? 'bg-navy text-white' : 'bg-stone/40 text-zinc-700'
                        }` }
                    >
                        { link.label }
                    </Link>;
                } ) }
            </div>
        </nav>
    </>;
}
