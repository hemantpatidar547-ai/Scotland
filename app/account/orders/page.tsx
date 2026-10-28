import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/ssr-server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import RefreshOnInterval from '@/components/RefreshOnInterval';

type OrderItemSnapshot = {
    name?: string;
    image?: string;
    size?: string;
    color?: string;
    quantity?: number;
    price?: number;
};

export default async function Orders ()
{
    const auth = await createClient();
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if ( authError || !user ) redirect( '/login?redirect=%2Faccount%2Forders' );

    const db = getSupabaseAdmin();
    const { data: orders, error } = await db.from( 'orders' )
        .select( 'id, order_number, created_at, order_status, payment_status, total_amount, final_amount, items' )
        .eq( 'user_id', user.id )
        .order( 'created_at', { ascending: false } );
    if ( error )
    {
        console.error( 'Customer order history fetch failed:', error );
        throw new Error( 'Could not load your order history.' );
    }

    return (
        <main className="shell py-12">
            <RefreshOnInterval />
            <p className="eyebrow">My account</p>
            <h1 className="display mt-2 text-5xl">My orders</h1>
            { !orders?.length ? (
                <div className="mt-9 bg-white p-10 text-center">
                    <p>You have not placed any orders yet.</p>
                    <Link className="button mt-5" href="/shop">Explore the collection</Link>
                </div>
            ) : (
                <div className="mt-8 space-y-5">
                    { orders.map( order =>
                    {
                        const items = ( order.items || [] ) as OrderItemSnapshot[];
                        const amount = Number( order.final_amount ?? order.total_amount ?? 0 );
                        return (
                            <article className="border border-stone bg-white p-5 sm:p-7" key={ order.id }>
                                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone pb-4">
                                    <div>
                                        <p className="eyebrow">Order { order.order_number }</p>
                                        <p className="mt-2 text-sm text-zinc-600">{ new Date( order.created_at ).toLocaleDateString( 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' } ) }</p>
                                    </div>
                                    <div className="text-right text-sm">
                                        <p className="font-semibold capitalize">{ String( order.order_status || 'pending' ).replaceAll( '_', ' ' ) }</p>
                                        <p className="mt-1 text-zinc-500">Payment: { order.payment_status || 'pending' }</p>
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    { items.slice( 0, 4 ).map( ( item, index ) => (
                                        <div className="flex items-center gap-3 text-sm" key={ `${ item.name }-${ index }` }>
                                            <div className="relative h-16 w-12 bg-stone">
                                                <Image src={ item.image || '/images/brand/scotland-lion.png' } alt={ item.name || 'Purchased product' } fill className="object-cover" sizes="48px" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{ item.name || 'Product' }</p>
                                                <p className="text-xs text-zinc-500">{ item.color } · { item.size } · Qty { item.quantity || 1 }</p>
                                            </div>
                                        </div>
                                    ) ) }
                                    { items.length > 4 && <p className="self-center text-xs text-zinc-500">and { items.length - 4 } more item(s)</p> }
                                </div>
                                <div className="mt-5 flex items-center justify-between border-t border-stone pt-4">
                                    <p className="text-sm">Order total <strong className="ml-2">₹{ amount.toLocaleString( 'en-IN' ) }</strong></p>
                                    <Link href={ `/account/orders/${ encodeURIComponent( order.order_number ) }` } className="button-outline">View details</Link>
                                </div>
                            </article>
                        );
                    } ) }
                </div>
            ) }
        </main>
    );
}
