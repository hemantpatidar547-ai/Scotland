import Link from 'next/link';
import { AdminLogoutButton } from '@/components/AdminLogoutButton';
import AdminNavigation from '@/components/admin/AdminNavigation';

export default function AdminLayout ( { children }: { children: React.ReactNode } )
{
    return (
        <div className="flex min-h-screen flex-col bg-stone/20 font-sans">
            <header className="sticky top-0 z-50 border-b border-navy/10 bg-white shadow-sm">
                <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <Link href="/admin" className="font-display text-xl tracking-widest text-navy sm:text-2xl">
                            SCOTLAND
                        </Link>
                        <span className="hidden h-6 border-l border-stone sm:block" />
                        <span className="hidden text-xs font-medium uppercase tracking-[.14em] text-zinc-500 sm:block">Store admin</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="hidden rounded-full bg-stone/50 px-3 py-1 text-[11px] font-medium text-zinc-600 sm:inline-flex">Owner workspace</span>
                        <AdminLogoutButton />
                    </div>
                </div>
            </header>
            <div className="flex flex-1">
                <AdminNavigation />
                <div className="min-w-0 flex-1">
                    <div className="border-b border-stone/70 bg-white/70 px-4 py-2 text-[11px] text-zinc-500 sm:px-6 lg:px-8">
                        Admin workspace <span className="mx-1 text-zinc-300">/</span> <span className="font-medium text-zinc-700">Private store operations</span>
                    </div>
                    { children }
                </div>
            </div>
        </div>
    );
}
