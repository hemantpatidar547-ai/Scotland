export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { DeliveryChargeToggle } from '@/components/CodChargeToggle';
import RefreshOnInterval from '@/components/RefreshOnInterval';

type DashboardOrder = {
    id: string;
    order_number: string;
    final_amount: number;
    order_status: string;
    payment_status: string;
    payment_method: string;
    created_at: string;
    shipping_address: { name?: string } | null;
    user_email: string | null;
    email: string | null;
};

function indiaDayStart ( date: Date )
{
    const parts = new Intl.DateTimeFormat( 'en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    } ).formatToParts( date );
    const values = Object.fromEntries( parts.map( part => [ part.type, part.value ] ) );
    return new Date( Date.UTC( Number( values.year ), Number( values.month ) - 1, Number( values.day ) ) - 330 * 60 * 1000 );
}

async function getDashboardStats ()
{
    const db = getSupabaseAdmin();
    const todayStart = indiaDayStart( new Date() );
    const dayStarts = Array.from( { length: 7 }, ( _, index ) =>
        new Date( todayStart.getTime() - ( 6 - index ) * 24 * 60 * 60 * 1000 )
    );

    const dailyResults = await Promise.all( dayStarts.map( async ( start, index ) =>
    {
        const end = index === dayStarts.length - 1
            ? new Date()
            : dayStarts[ index + 1 ];
        const { count, error } = await db.from( 'orders' )
            .select( 'id', { count: 'exact', head: true } )
            .is( 'admin_archived_at', null )
            .gte( 'created_at', start.toISOString() )
            .lt( 'created_at', end.toISOString() );
        if ( error ) throw error;
        return {
            date: start.toISOString(),
            label: new Intl.DateTimeFormat( 'en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric' } ).format( start ),
            count: count || 0,
        };
    } ) );

    const [ { count: totalOrders, error: totalError }, { data: recentOrders, error: recentError } ] = await Promise.all( [
        db.from( 'orders' ).select( 'id', { count: 'exact', head: true } ).is( 'admin_archived_at', null ),
        db.from( 'orders' )
            .select( 'id, order_number, final_amount, order_status, payment_status, payment_method, created_at, shipping_address, user_email, email' )
            .is( 'admin_archived_at', null )
            .order( 'created_at', { ascending: false } )
            .limit( 6 ),
    ] );
    if ( totalError ) throw totalError;
    if ( recentError ) throw recentError;

    return {
        totalOrders: totalOrders || 0,
        todayOrders: dailyResults[ dailyResults.length - 1 ]?.count || 0,
        weekOrders: dailyResults.reduce( ( total, day ) => total + day.count, 0 ),
        dailyOrders: dailyResults,
        recentOrders: ( recentOrders || [] ) as DashboardOrder[],
    };
}

export default async function Admin ()
{
    let stats: Awaited<ReturnType<typeof getDashboardStats>> | null = null;
    let loadError = false;
    try
    {
        stats = await getDashboardStats();
    } catch ( error )
    {
        console.error( 'Admin dashboard data error:', error );
        loadError = true;
    }

    const money = ( amount: number ) => new Intl.NumberFormat( 'en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    } ).format( amount || 0 );
    const maxDailyOrders = Math.max( 1, ...( stats?.dailyOrders.map( day => day.count ) || [] ) );

    return (
        <main className="shell py-8 sm:py-10">
            <RefreshOnInterval />
            <div className="flex flex-col items-start justify-between gap-5 border-b border-stone pb-6 sm:flex-row sm:items-end">
                <div>
                    <p className="eyebrow text-zinc-500">Store operations</p>
                    <h1 className="display mt-2 text-4xl text-navy sm:text-5xl">Admin dashboard</h1>
                    <p className="mt-2 text-sm text-zinc-600">A clear view of order volume and the work that needs attention.</p>
                </div>
                <Link className="button w-full text-center sm:w-auto" href="/admin/orders">Open order management</Link>
            </div>

            { loadError ? (
                <p className="mt-6 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
                    Dashboard data could not be loaded. Check the server logs and Supabase connection; figures are not being shown as zero.
                </p>
            ) : stats && <>
                <section className="mt-6 grid gap-3 sm:grid-cols-3">
                    <MetricCard label="Orders today" value={ stats.todayOrders } hint="India time · since midnight" />
                    <MetricCard label="Orders in last 7 days" value={ stats.weekOrders } hint="Daily counts shown below" />
                    <MetricCard label="All-time orders" value={ stats.totalOrders } hint="All orders in the store database" />
                </section>

                <section className="mt-6 border border-stone bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h2 className="display text-2xl text-navy">Orders by day</h2>
                            <p className="mt-1 text-sm text-zinc-500">New orders grouped by India calendar day.</p>
                        </div>
                        <span className="text-xs text-zinc-500">Last 7 days · Asia/Kolkata</span>
                    </div>
                    <div className="mt-6 grid grid-cols-7 gap-2 sm:gap-4" aria-label="Order count for each of the last seven days">
                        { stats.dailyOrders.map( day => (
                            <div key={ day.date } className="flex min-w-0 flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-navy">{ day.count }</span>
                                <div className="flex h-32 w-full items-end justify-center bg-stone/30">
                                    <div
                                        className="w-2/3 max-w-10 bg-gold transition-[height]"
                                        style={ { height: `${ Math.max( day.count ? 8 : 2, day.count / maxDailyOrders * 100 ) }%` } }
                                        title={ `${ day.count } orders` }
                                    />
                                </div>
                                <span className="text-[11px] text-zinc-500">{ day.label }</span>
                            </div>
                        ) ) }
                    </div>
                </section>

                <section className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
                    <div className="border border-stone bg-white p-5 shadow-sm sm:p-6">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="display text-2xl text-navy">Recent orders</h2>
                                <p className="mt-1 text-sm text-zinc-500">Latest orders from the store database.</p>
                            </div>
                            <Link href="/admin/orders" className="shrink-0 text-sm font-semibold text-navy underline">View all</Link>
                        </div>
                        { stats.recentOrders.length === 0 ? (
                            <p className="py-6 text-sm text-zinc-500">No orders have been placed yet.</p>
                        ) : (
                            <div className="divide-y divide-stone">
                                { stats.recentOrders.map( order => (
                                    <Link
                                        key={ order.id }
                                        href="/admin/orders"
                                        className="flex flex-col gap-2 py-4 text-sm transition hover:bg-stone/10 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div>
                                            <p className="font-semibold text-navy">{ order.order_number }</p>
                                            <p className="mt-1 text-xs text-zinc-500">
                                                { order.shipping_address?.name || order.user_email || order.email || 'Customer' }
                                                {' · '}
                                                { new Date( order.created_at ).toLocaleString( 'en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' } ) }
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                                            <span className="text-xs capitalize text-zinc-600">{ order.order_status.replaceAll( '_', ' ' ) }</span>
                                            <span className="font-semibold text-navy">{ money( Number( order.final_amount ) ) }</span>
                                        </div>
                                    </Link>
                                ) ) }
                            </div>
                        ) }
                    </div>

                    <div className="border border-stone bg-white p-5 shadow-sm sm:p-6">
                        <h2 className="display text-2xl text-navy">Operations</h2>
                        <p className="mt-1 text-sm text-zinc-500">Open the right workspace for each task.</p>
                        <div className="mt-5 grid gap-3">
                            <Link className="button-outline text-center" href="/admin/orders">Review orders, returns &amp; invoices</Link>
                            <Link className="button-outline text-center" href="/admin/courier">Courier &amp; billing</Link>
                            <Link className="button-outline text-center" href="/admin/products">Manage products</Link>
                            <Link className="button-outline text-center" href="/admin/products/new">Add product</Link>
                            <Link className="button-outline text-center" href="/admin/homepage">Homepage content &amp; images</Link>
                        </div>
                        <p className="mt-5 border-l-2 border-amber-400 pl-3 text-xs leading-5 text-zinc-600">
                            Delivery progress must come from the courier. Shipment creation and live location remain unavailable until the account&apos;s official API workflow supports them.
                        </p>
                    </div>
                </section>

                <section className="mt-8">
                    <h2 className="display mb-3 text-xl text-navy">Delivery settings</h2>
                    <DeliveryChargeToggle />
                </section>
            </> }
        </main>
    );
}

function MetricCard ( { label, value, hint }: { label: string; value: number; hint: string } )
{
    return <article className="border border-stone bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">{ label }</p>
        <p className="mt-2 text-3xl font-semibold text-navy">{ value.toLocaleString( 'en-IN' ) }</p>
        <p className="mt-1 text-xs text-zinc-500">{ hint }</p>
    </article>;
}
