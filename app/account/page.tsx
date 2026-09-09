import Link from 'next/link';
import { createClient } from '@/lib/supabase/ssr-server';
import { logoutAuth } from './actions';

export default async function Account ()
{
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    return (
        <main className="shell py-12 min-h-[70vh]">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="eyebrow">My account</p>
                    <h1 className="display mt-3 text-5xl">Welcome back.</h1>
                    <p className="mt-3 text-zinc-500">Logged in as: { user?.email }</p>
                </div>

                <form action={ logoutAuth }>
                    <button className="button bg-stone text-navy hover:text-white" type="submit">
                        Log out
                    </button>
                </form>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                { [
                    [ 'Orders', 'View your delivery and order history', '/account/orders' ],
                    [ 'Saved pieces', 'Your wishlist', '/wishlist' ],
                    [ 'Profile', 'Addresses and style preferences', '#' ],
                    [ 'Settings', 'Account security and notifications', '#' ],
                ].map( ( [ t, d, h ] ) => (
                    <Link key={ t } href={ h } className="block group bg-white p-6 border border-stone/50 rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                        <h2 className="font-semibold text-navy group-hover:text-gold transition-colors">{ t }</h2>
                        <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{ d }</p>
                    </Link>
                ) ) }
            </div>
        </main>
    );
}
