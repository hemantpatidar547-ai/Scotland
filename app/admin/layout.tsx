import Link from 'next/link';
import { AdminLogoutButton } from '@/components/AdminLogoutButton';

export default function AdminLayout ( { children }: { children: React.ReactNode } )
{
    return (
        <div className="min-h-screen bg-stone/20 flex flex-col font-sans">
            {/* PROFESSIONAL ADMIN TOPBAR */ }
            <header className="bg-navy text-white sticky top-0 z-50 shadow-md">
                <div className="shell flex items-center justify-between h-16">
                    <div className="flex items-center gap-8">
                        <Link href="/admin" className="font-display text-2xl tracking-widest uppercase">
                            SCOTLAND <span className="text-gold text-sm ml-2 tracking-normal">Admin</span>
                        </Link>

                        <nav className="hidden md:flex gap-6 text-sm font-medium text-stone/80">
                            <Link href="/admin" className="hover:text-white transition">Dashboard</Link>
                            <Link href="/admin/orders" className="hover:text-white transition">Orders</Link>
                            <Link href="/admin/courier" className="hover:text-white transition">Courier &amp; Billing</Link>
                            <Link href="/admin/products" className="hover:text-white transition">Products</Link>
                            <Link href="/admin/homepage" className="hover:text-white transition">Homepage Content</Link>
                            <Link href="/admin/seo" className="hover:text-white transition">SEO &amp; Google Products</Link>
                            <Link href="/admin/customers" className="hover:text-white transition">Customers</Link>
                        </nav>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                        <Link href="/" className="hover:text-gold transition underline decoration-stone/50 underline-offset-4">View Live Store</Link>
                        <AdminLogoutButton />
                    </div>
                </div>
            </header>

            {/* DASHBOARD CONTENT SPACE */ }
            <div className="flex-1 w-full">
                { children }
            </div>
        </div>
    );
}
