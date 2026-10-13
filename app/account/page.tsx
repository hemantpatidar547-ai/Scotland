import Link from 'next/link';
import { AccountLogoutButton } from '@/components/AccountLogoutButton';
import { getAuthenticatedCustomer } from '@/lib/customer-auth';
import { redirect } from 'next/navigation';

export default async function Account ()
{
    const { user } = await getAuthenticatedCustomer();

    if ( !user )
    {
        redirect( '/login?redirect=/account' );
    }

    const displayName = user.name || '';
    const displayIdentity = user.email || ( user.mobile ? `+91 ${ user.mobile }` : '' );

    return (
        <main className="shell py-12 min-h-[70vh]">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="eyebrow">My account</p>
                    <h1 className="display mt-3 text-5xl">Welcome{ displayName ? `, ${ displayName }.` : ' back.' }</h1>
                    { displayIdentity && <p className="mt-3 text-zinc-500">Signed in as { displayIdentity }</p> }
                </div>

                <AccountLogoutButton />
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                { [
                    [ 'Orders', 'View your delivery and order history', '/account/orders' ],
                    [ 'My cart', 'Continue where you left off', '/cart' ],
                    [ 'Saved pieces', 'Your wishlist', '/wishlist' ],
                    [ 'Profile & addresses', 'Manage your personal details and delivery addresses', '/account/profile' ],
                    [ 'Account security', 'Change your password and review account access', '/account/security' ],
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
