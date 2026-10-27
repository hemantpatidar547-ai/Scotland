'use client';

import { useEffect, useState } from 'react';

type CourierOrder = {
    id: string;
    orderNumber: string;
    createdAt: string;
    orderStatus: string;
    paymentStatus: string;
    paymentMethod: string;
    amount: number;
    deliveryCharge: number;
    courierName: string | null;
    trackingNumber: string | null;
    courierStatus: string | null;
    courierStatusUpdatedAt: string | null;
    courierShippingCharge: number | null;
    customerName: string;
    customerPhone: string;
    itemCount: number;
    returnStatus: string | null;
    returnRefundAmount: number | null;
};

type DashboardData = {
    data: CourierOrder[];
    summary: {
        periodDays: number;
        totalOrders: number;
        ordersWithoutAwb: number;
        trackedShipments: number;
        inTransit: number;
        delivered: number;
        courierRto: number;
        customerReturnCases: number;
        storeMarkedDelivered: number;
        cancelled: number;
        paymentCollected: number;
        refunds: number;
        netReceipts: number;
        courierChargesReported: number;
        ordersWithUnknownCourierCharge: number;
    };
    limit: number;
};

const money = ( amount: number ) => new Intl.NumberFormat( 'en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
} ).format( amount );

export default function CourierDashboard ()
{
    const [ dashboard, setDashboard ] = useState<DashboardData | null>( null );
    const [ loading, setLoading ] = useState( true );
    const [ error, setError ] = useState( '' );
    const [ search, setSearch ] = useState( '' );

    async function loadDashboard ()
    {
        setLoading( true );
        setError( '' );
        try
        {
            const response = await fetch( '/api/admin/courier', { cache: 'no-store' } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not load courier data.' );
            setDashboard( result );
        } catch ( cause )
        {
            setError( cause instanceof Error ? cause.message : 'Could not load courier data.' );
        } finally
        {
            setLoading( false );
        }
    }

    useEffect( () => { void loadDashboard(); }, [] );

    const summary = dashboard?.summary;
    const visibleOrders = ( dashboard?.data || [] ).filter( order =>
        `${ order.orderNumber } ${ order.customerName } ${ order.customerPhone } ${ order.trackingNumber || '' }`
            .toLowerCase()
            .includes( search.toLowerCase() )
    );
    const cards = summary ? [
        { label: 'Orders without AWB', value: summary.ordersWithoutAwb, tone: 'text-amber-700' },
        { label: 'AWBs / tracking saved', value: summary.trackedShipments, tone: 'text-sky-700' },
        { label: 'Courier status: in transit', value: summary.inTransit, tone: 'text-blue-700' },
        { label: 'Courier status: delivered', value: summary.delivered, tone: 'text-emerald-700' },
        { label: 'Courier status: RTO/return', value: summary.courierRto, tone: 'text-violet-700' },
        { label: 'Customer return cases', value: summary.customerReturnCases, tone: 'text-fuchsia-700' },
        { label: 'Store-marked cancellations', value: summary.cancelled, tone: 'text-rose-700' },
    ] : [];

    return <main className="shell py-8 sm:py-10">
        <div className="flex flex-col gap-5 border-b border-stone pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p className="eyebrow text-zinc-500">Operations · Supabase orders</p>
                <h1 className="display mt-2 text-4xl text-navy">Courier &amp; billing</h1>
                <p className="mt-2 max-w-2xl text-sm text-zinc-600">One place to review parcels, delivery status, returns, payments, courier charges, and invoices.</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <a href="/admin/orders" className="button-outline text-center">Manage orders</a>
                <button type="button" onClick={ () => void loadDashboard() } className="button text-center" disabled={ loading }>
                    { loading ? 'Refreshing…' : 'Refresh data' }
                </button>
            </div>
        </div>

        <section className="mt-6 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Delhivery API actions are not connected yet</p>
            <p className="mt-1 leading-6">Shipment creation, labels, and automatic carrier scans are not connected, so this dashboard does not submit parcels. Courier counters below use only saved AWBs and courier statuses; they are not newly dispatched parcels. Order delivery status and customer return requests are shown separately and do not prove courier handover. We have removed manual courier-status editing so delivery progress cannot be entered as if it came from Delhivery.</p>
        </section>

        { error && <p className="mt-5 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{ error }</p> }

        { loading && !dashboard ? <p className="mt-8 text-sm text-zinc-600">Loading real order data…</p> : null }
        { dashboard && summary && <>
            <p className="mt-6 text-xs uppercase tracking-wider text-zinc-500">Last { summary.periodDays } days · Up to { dashboard.limit } most recent orders</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                { cards.map( card => <article key={ card.label } className="border border-stone bg-white p-4 shadow-sm">
                    <p className="text-sm text-zinc-600">{ card.label }</p>
                    <p className={ `mt-2 text-3xl font-semibold ${ card.tone }` }>{ card.value }</p>
                </article> ) }
            </div>
            <p className="mt-3 text-xs text-zinc-500">For comparison, { summary.storeMarkedDelivered } orders are marked delivered in the store database; this is not counted as courier-confirmed delivery.</p>

            <section className="mt-8">
                <div className="flex flex-col gap-3 border-b border-stone pb-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="display text-2xl text-navy">Cash &amp; courier reconciliation</h2>
                        <p className="mt-1 text-xs text-zinc-500">Collected means orders marked paid. Courier cost includes only amounts already saved from an actual courier charge.</p>
                    </div>
                    <a href="/admin/orders" className="text-sm font-semibold text-navy underline">Open billing &amp; invoices</a>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <FinancialCard label="Payments collected" value={ money( summary.paymentCollected ) } />
                    <FinancialCard label="Refunds recorded" value={ money( summary.refunds ) } />
                    <FinancialCard label="Net receipts" value={ money( summary.netReceipts ) } />
                    <FinancialCard label="Courier charges recorded" value={ money( summary.courierChargesReported ) } />
                </div>
                <p className="mt-3 border-l-2 border-zinc-300 pl-3 text-xs leading-5 text-zinc-600">
                    { summary.ordersWithUnknownCourierCharge } shipped orders have no courier charge recorded. Profit/loss is not shown: order-time product cost is not stored in the order snapshot, so calculating it from today's catalog cost would be misleading.
                </p>
            </section>

            <section className="mt-9">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="display text-2xl text-navy">Parcel register</h2>
                        <p className="mt-1 text-sm text-zinc-500">Search orders and view saved courier/AWB details. Delivery status is not editable here.</p>
                    </div>
                    <input
                        value={ search }
                        onChange={ event => setSearch( event.target.value ) }
                        className="w-full border border-stone bg-white px-3 py-2 text-sm sm:max-w-xs"
                        placeholder="Search order, customer, phone, AWB"
                    />
                </div>
                <div className="overflow-x-auto border border-stone bg-white">
                    <table className="w-full min-w-[900px] text-left text-sm">
                        <thead className="bg-stone/40 text-xs uppercase tracking-wide text-zinc-600">
                            <tr>
                                <th className="p-3">Order / Customer</th><th className="p-3">Parcel</th><th className="p-3">Delivery status</th><th className="p-3">Payment</th><th className="p-3">Courier cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone">
                            { visibleOrders.map( order => <tr key={ order.id } className="align-top">
                                    <td className="p-3">
                                        <a className="font-semibold text-navy underline" href="/admin/orders">{ order.orderNumber }</a>
                                        <p className="mt-1">{ order.customerName }</p>
                                        <p className="text-xs text-zinc-500">{ order.customerPhone || 'No phone saved' }</p>
                                    </td>
                                    <td className="p-3">
                                        <p>{ order.courierName || 'Courier not set' }</p>
                                        <p className="text-xs text-zinc-500">{ order.trackingNumber ? `AWB ${ order.trackingNumber }` : 'AWB not saved' }</p>
                                        <p className="mt-1 text-xs text-zinc-500">{ order.itemCount } product units</p>
                                    </td>
                                    <td className="p-3">
                                        <p className="font-medium">{ order.trackingNumber ? ( order.courierStatus || 'AWB saved · courier status not recorded' ) : 'No courier tracking record' }</p>
                                        <p className="mt-1 text-xs capitalize text-zinc-500">Store order: { order.orderStatus.replaceAll( '_', ' ' ) }</p>
                                        { order.courierStatusUpdatedAt && <p className="mt-1 text-xs text-zinc-500">{ new Date( order.courierStatusUpdatedAt ).toLocaleString( 'en-IN' ) }</p> }
                                        { order.returnStatus && <p className="mt-1 text-xs text-violet-700">Return: { order.returnStatus }</p> }
                                    </td>
                                    <td className="p-3">
                                        <p className="font-medium">{ money( order.amount ) }</p>
                                        <p className="text-xs capitalize text-zinc-500">{ order.paymentMethod || 'payment' } · { order.paymentStatus }</p>
                                    </td>
                                    <td className="p-3">{ order.courierShippingCharge === null ? 'Not recorded' : money( order.courierShippingCharge ) }</td>
                                </tr> ) }
                            { !visibleOrders.length && <tr><td colSpan={ 5 } className="p-8 text-center text-sm text-zinc-500">No matching orders in this 30-day view.</td></tr> }
                        </tbody>
                    </table>
                </div>
            </section>
        </> }
    </main>;
}

function FinancialCard ( { label, value }: { label: string; value: string } )
{
    return <article className="border border-stone bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-zinc-500">{ label }</p>
        <p className="mt-2 text-xl font-semibold text-navy">{ value }</p>
    </article>;
}
