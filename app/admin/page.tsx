import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { DeliveryChargeToggle } from '@/components/CodChargeToggle';

const money = ( n: number ) => new Intl.NumberFormat( 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 } ).format( n );

async function getDashboardStats ()
{
    try
    {
        const db = getSupabaseAdmin();
        const { data: orders } = await db.from( 'orders' ).select( '*' ).order( 'created_at', { ascending: false } );

        const allOrders = orders || [];
        const totalSales = allOrders.reduce( ( sum, order ) => sum + ( order.final_amount || 0 ), 0 );
        const totalOrders = allOrders.length;
        const pendingOrders = allOrders.filter( o => o.order_status === 'pending' || o.order_status === 'processing' ).length;

        const recentOrders = allOrders.slice( 0, 5 ).map( o => ( {
            id: o.id,
            number: o.order_number,
            customer: o.shipping_address?.name || o.user_email || 'Unknown',
            amount: o.final_amount || 0,
            status: o.order_status || 'pending'
        } ) );

        return { sales: totalSales, totalOrders, pending: pendingOrders, recentOrders };
    } catch
    {
        return { sales: 0, totalOrders: 0, pending: 0, recentOrders: [] };
    }
}

export default async function Admin ()
{
    const stats = await getDashboardStats();

    const cards = [
        [ money( stats.sales ), 'Total sales' ],
        [ stats.totalOrders.toString(), 'Total orders' ],
        [ stats.pending.toString(), 'Pending orders' ],
        [ '0', 'Low-stock products' ] // Placeholder for low stock logic
    ];

    return (
        <main className="shell py-10 sm:py-12">
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="eyebrow">Admin dashboard</p>
                    <h1 className="display mt-3 text-4xl sm:text-5xl">Store overview</h1>
                </div>
                <Link className="button w-full sm:w-auto" href="/admin/products">Manage products</Link>
            </div>

            <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 lg:grid-cols-4">
                { cards.map( ( [ n, t ] ) => (
                    <div className="bg-white p-5 border border-stone shadow-sm" key={ t }>
                        <p className="eyebrow text-zinc-500">{ t }</p>
                        <p className="mt-3 text-3xl font-semibold">{ n }</p>
                    </div>
                ) ) }
            </div>

            <div className="mt-8 grid gap-5 sm:mt-10 lg:grid-cols-2">
                <section className="bg-white p-5 sm:p-6 border border-stone shadow-sm">
                    <div className="flex justify-between items-center mb-5">
                        <h2 className="display text-2xl">Recent orders</h2>
                        <Link href="/admin/orders" className="text-xs uppercase tracking-widest text-navy underline decoration-navy/30 hover:decoration-navy">View all</Link>
                    </div>
                    { stats.recentOrders.length === 0 ? (
                        <p className="text-sm text-zinc-500">No orders yet.</p>
                    ) : (
                        stats.recentOrders.map( o => (
                            <div key={ o.id } className="border-b border-stone py-4 text-sm flex justify-between items-center">
                                <div>
                                    <span className="font-semibold text-navy">{ o.number }</span>
                                    <span className="text-zinc-500 ml-2">— { o.customer } —</span>
                                    <span className="ml-1 font-medium">{ money( o.amount ) }</span>
                                </div>
                                <span className={ `text-xs uppercase font-semibold tracking-wider ${ o.status === 'delivered' ? 'text-emerald-600' : 'text-orange-600' }` }>
                                    { o.status }
                                </span>
                            </div>
                        ) )
                    ) }
                </section>

                <section className="bg-white p-5 sm:p-6 border border-stone shadow-sm">
                    <h2 className="display text-2xl mb-5">Quick actions</h2>
                    <div className="grid gap-3">
                        <Link className="button-outline text-center" href="/admin/products/new">Add new product</Link>
                        <Link className="button-outline text-center" href="/admin/orders">Manage all orders</Link>
                        <Link className="button-outline text-center" href="/admin/products">Manage products catalog</Link>
                        <Link className="button-outline text-center" href="/admin/homepage">Manage homepage content &amp; images</Link>
                        <Link className="button-outline text-center" href="/admin/seo">SEO &amp; Google Products</Link>
                    </div>
                </section>
            </div>

            { /* COD Settings Panel */ }
            <div className="mt-8">
                <h2 className="display text-xl mb-3">Delivery Settings</h2>
                <DeliveryChargeToggle />
            </div>
        </main>
    );
}
