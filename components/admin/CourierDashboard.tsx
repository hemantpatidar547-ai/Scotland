'use client';

import { useCallback, useEffect, useState } from 'react';
import DeliveryServiceabilityPanel from '@/components/admin/DeliveryServiceabilityPanel';

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
    courierDispatchQueued: boolean;
    courierApiSubmissionState: 'pending' | 'submitting' | 'submitted' | 'needs_review';
    courierApiSubmissionError: string | null;
    courierPackageWeightG: number | null;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    shippingAddress: {
        address?: string;
        city?: string;
        state?: string;
        country?: string;
        postalCode?: string;
    } | null;
    items: Array<{
        name: string;
        quantity: number;
        size: string;
        color: string;
        sku: string;
        unitPrice: number;
    }>;
    itemCount: number;
    returnStatus: string | null;
    returnRefundAmount: number | null;
};

type DashboardData = {
    data: CourierOrder[];
    queuedOrders: CourierOrder[];
    summary: {
        periodDays: number;
        totalOrders: number;
        awaitingCourierSubmission: number;
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
    const [ updatingQueueIds, setUpdatingQueueIds ] = useState<Set<string>>( new Set() );
    const [ packageWeights, setPackageWeights ] = useState<Record<string, string>>( {} );
    const [ orderAwaitingConfirmation, setOrderAwaitingConfirmation ] = useState<CourierOrder | null>( null );
    const [ notice, setNotice ] = useState( '' );

    const loadDashboard = useCallback( async ( showLoading = true ) =>
    {
        if ( showLoading ) setLoading( true );
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
            if ( showLoading ) setLoading( false );
        }
    }, [] );

    useEffect( () =>
    {
        void loadDashboard();
        const refreshWhenVisible = () =>
        {
            if ( document.visibilityState === 'visible' ) void loadDashboard( false );
        };
        const interval = window.setInterval( refreshWhenVisible, 15000 );
        document.addEventListener( 'visibilitychange', refreshWhenVisible );
        return () =>
        {
            window.clearInterval( interval );
            document.removeEventListener( 'visibilitychange', refreshWhenVisible );
        };
    }, [ loadDashboard ] );

    const summary = dashboard?.summary;
    async function deleteFromCourierList ( order: CourierOrder )
    {
        if ( !window.confirm( `Remove ${ order.orderNumber } from the courier dashboard? Its customer, address, and product details will no longer appear in this courier section. The order and its history will remain in Order Management and the customer's account.` ) ) return;
        setError( '' );
        setUpdatingQueueIds( current => new Set( current ).add( order.id ) );
        try
        {
            const response = await fetch( `/api/admin/orders/${ encodeURIComponent( order.id ) }/courier-queue`, {
                method: 'DELETE',
            } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not remove the order from the courier dashboard.' );
            await loadDashboard();
        } catch ( cause )
        {
            setError( cause instanceof Error ? cause.message : 'Could not remove the order from the courier dashboard.' );
        } finally
        {
            setUpdatingQueueIds( current =>
            {
                const next = new Set( current );
                next.delete( order.id );
                return next;
            } );
        }
    }

    function requestCourierSubmission ( order: CourierOrder )
    {
        const weightGrams = Number( packageWeights[ order.id ] || order.courierPackageWeightG || 0 );
        if ( !Number.isSafeInteger( weightGrams ) || weightGrams < 1 || weightGrams > 100000 )
        {
            setError( 'Enter the packed parcel weight in grams before submitting.' );
            return;
        }
        setOrderAwaitingConfirmation( order );
    }

    async function confirmCourierSubmission ()
    {
        const order = orderAwaitingConfirmation;
        if ( !order ) return;
        const weightGrams = Number( packageWeights[ order.id ] || order.courierPackageWeightG || 0 );
        setOrderAwaitingConfirmation( null );
        setError( '' );
        setNotice( '' );
        setUpdatingQueueIds( current => new Set( current ).add( order.id ) );
        try
        {
            const response = await fetch( `/api/admin/orders/${ encodeURIComponent( order.id ) }/delhivery-sandbox`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { weightGrams } ),
            } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not submit to Delhivery sandbox.' );
            setPackageWeights( current => ( { ...current, [ order.id ]: '' } ) );
            setNotice( `Shipment created in Delhivery sandbox for ${ order.orderNumber }. AWB: ${ result.waybill }.${ result.auditRecorded === false ? ' Audit result could not be updated; do not resubmit.' : '' }` );
            await loadDashboard();
        } catch ( cause )
        {
            setError( cause instanceof Error ? cause.message : 'Could not submit to Delhivery sandbox.' );
            await loadDashboard( false );
        } finally
        {
            setUpdatingQueueIds( current =>
            {
                const next = new Set( current );
                next.delete( order.id );
                return next;
            } );
        }
    }

    const visibleOrders = ( dashboard?.data || [] ).filter( order =>
        `${ order.orderNumber } ${ order.customerName } ${ order.customerPhone } ${ order.trackingNumber || '' }`
            .toLowerCase()
            .includes( search.toLowerCase() )
    );
    const cards = summary ? [
        { label: 'Admin-approved queue · pending/review', value: summary.awaitingCourierSubmission, tone: 'text-amber-700' },
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
            <p className="font-semibold">Sandbox shipment testing only</p>
            <p className="mt-1 leading-6">A confirmed order can be sent to the Delhivery sandbox below after entering its packed weight. This is not a live booking. Production shipment creation, labels, automatic carrier scans, and live GPS are not enabled. Manifested means Delhivery accepted the test request; it does not mean the parcel was picked up or delivered.</p>
        </section>

        <DeliveryServiceabilityPanel />

        { error && <p className="mt-5 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{ error }</p> }
        { notice && <p className="mt-5 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{ notice }</p> }

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

            <section className="mt-8 border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3 border-b border-stone pb-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="display text-2xl text-navy">Confirmed for courier</h2>
                        <p className="mt-1 text-sm text-zinc-600">Admin-approved orders appear here first. The sandbox action sends the address and parcel data to Delhivery's test environment, not to production.</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
                        { dashboard.queuedOrders.length } waiting for API
                    </span>
                </div>
                { dashboard.queuedOrders.length === 0 ? (
                    <p className="py-6 text-sm text-zinc-500">No orders are waiting in the courier queue. Confirm an eligible order from Order Management.</p>
                ) : (
                    <div className="mt-4 space-y-3">
                        { dashboard.queuedOrders.map( order => <article key={ order.id } className="border border-stone bg-stone/10 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <a className="font-semibold text-navy underline" href="/admin/orders">{ order.orderNumber }</a>
                                    <p className="mt-1 text-sm font-medium">{ order.customerName } · { order.customerPhone || 'No phone saved' }</p>
                                    { order.customerEmail && <p className="text-xs text-zinc-600">{ order.customerEmail }</p> }
                                    <p className="mt-1 text-xs text-zinc-600">
                                        {[ order.shippingAddress?.address, order.shippingAddress?.city, order.shippingAddress?.state, order.shippingAddress?.postalCode ]
                                            .filter( Boolean )
                                            .join( ', ' ) || 'Shipping address not available'}
                                    </p>
                                </div>
                                <div className="text-left sm:text-right">
                                    <p className="font-semibold text-navy">{ money( order.amount ) }</p>
                                    <p className="mt-1 text-xs capitalize text-zinc-600">{ order.paymentMethod || 'Payment' } · { order.paymentStatus }</p>
                                    <p className="mt-2 text-xs font-semibold text-amber-800">Admin-approved · { order.courierApiSubmissionState.replaceAll( '_', ' ' ) }</p>
                                </div>
                            </div>
                            <div className="mt-4 border-t border-stone pt-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Products · { order.itemCount } units</p>
                                <ul className="mt-2 space-y-1 text-sm">
                                    { order.items.map( ( item, index ) => <li key={ `${ order.id }-${ index }` }>
                                        { item.name } · Qty { item.quantity }
                                        { item.size && ` · ${ item.size }` }
                                        { item.color && ` · ${ item.color }` }
                                        { ` · ${ money( item.unitPrice ) } each` }
                                        { item.sku && <span className="text-xs text-zinc-500"> · SKU { item.sku }</span> }
                                    </li> ) }
                                </ul>
                                { order.courierApiSubmissionState === 'pending' && <div className="mt-4 flex flex-col gap-2 border-t border-stone pt-3 sm:flex-row sm:items-end">
                                    <label className="text-xs font-semibold text-zinc-700">
                                        Packed parcel weight (grams)
                                        <input
                                            type="number"
                                            min="1"
                                            max="100000"
                                            step="1"
                                            required
                                            value={ packageWeights[ order.id ] ?? order.courierPackageWeightG ?? '' }
                                            onChange={ event => setPackageWeights( current => ( { ...current, [ order.id ]: event.target.value } ) ) }
                                            className="mt-1 block w-full border border-stone bg-white px-3 py-2 text-sm sm:w-56"
                                            placeholder="Weigh the packed parcel"
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={ () => requestCourierSubmission( order ) }
                                        disabled={ updatingQueueIds.has( order.id ) || !packageWeights[ order.id ] && !order.courierPackageWeightG }
                                        className="button-outline text-sm disabled:opacity-50"
                                    >
                                        { updatingQueueIds.has( order.id ) ? 'Sending…' : 'Send to Courier' }
                                    </button>
                                </div> }
                                { order.courierApiSubmissionState === 'submitted' && <p className="mt-3 border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                                    Shipment Created · Delhivery sandbox · AWB { order.trackingNumber || 'saved' }
                                </p> }
                                { order.courierApiSubmissionState === 'needs_review' && <p className="mt-3 border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800" role="alert">
                                    Check this submission in the Delhivery sandbox before any retry. { order.courierApiSubmissionError }
                                </p> }
                                { order.courierApiSubmissionState === 'submitting' && <p className="mt-3 text-xs text-amber-800">Submission is still being reconciled. Do not retry until its carrier outcome is checked.</p> }
                                <button
                                    type="button"
                                    onClick={ () => void deleteFromCourierList( order ) }
                                    disabled={ updatingQueueIds.has( order.id ) || Boolean( order.trackingNumber ) || order.courierApiSubmissionState !== 'pending' }
                                    className="mt-3 text-xs font-semibold text-rose-700 underline disabled:opacity-50"
                                >
                                    { updatingQueueIds.has( order.id ) ? 'Removing…' : 'Delete from courier list' }
                                </button>
                                { !order.trackingNumber && <p className="mt-1 text-[11px] text-zinc-500">Removes customer/product details from Courier &amp; Billing only. Order history and billing records stay unchanged.</p> }
                            </div>
                        </article> ) }
                    </div>
                ) }
            </section>
            { orderAwaitingConfirmation && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <section
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="courier-confirm-title"
                    className="w-full max-w-md border border-stone bg-white p-6 shadow-xl"
                >
                    <h2 id="courier-confirm-title" className="display text-2xl text-navy">Confirm courier submission</h2>
                    <p className="mt-3 text-sm leading-6 text-zinc-700">Are you sure you want to send this order&apos;s information to the courier company?</p>
                    <p className="mt-2 text-sm text-zinc-600">Order { orderAwaitingConfirmation.orderNumber } will be sent to the Delhivery sandbox for testing only. This does not create a live shipment.</p>
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={ () => setOrderAwaitingConfirmation( null ) } className="button-outline">Cancel</button>
                        <button type="button" onClick={ () => void confirmCourierSubmission() } className="button">Confirm &amp; Send</button>
                    </div>
                </section>
            </div> }

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
                                        <p className="font-medium">{ order.trackingNumber ? ( order.courierApiSubmissionState === 'submitted' ? 'Shipment Created · ' : '' ) + ( order.courierStatus || 'AWB saved · courier status not recorded' ) : 'No courier tracking record' }</p>
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
