'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';

type AdminOrder = {
    id: string;
    orderNumber: string;
    createdAt: string;
    orderStatus: string;
    paymentStatus: string;
    total: number;
};

type AdminCustomer = {
    userId: string;
    name: string;
    email: string;
    phone: string;
    registeredAt: string;
    orderCount: number;
    completedOrders: number;
    pendingOrders: number;
    cancelledOrders: number;
    totalSpent: number;
    lastOrderAt: string | null;
    orders: AdminOrder[];
};

const money = ( amount: number ) => new Intl.NumberFormat( 'en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
} ).format( amount );

function displayDate ( value: string | null )
{
    return value ? new Date( value ).toLocaleDateString( 'en-IN' ) : '—';
}

export default function AdminCustomersPage ()
{
    const [ customers, setCustomers ] = useState<AdminCustomer[]>( [] );
    const [ summary, setSummary ] = useState( { totalCustomers: 0, newToday: 0, newThisMonth: 0 } );
    const [ page, setPage ] = useState( 1 );
    const [ totalPages, setTotalPages ] = useState( 1 );
    const [ search, setSearch ] = useState( '' );
    const [ from, setFrom ] = useState( '' );
    const [ to, setTo ] = useState( '' );
    const [ loading, setLoading ] = useState( true );
    const [ error, setError ] = useState<string | null>( null );
    const [ expandedCustomer, setExpandedCustomer ] = useState<string | null>( null );

    const loadCustomers = useCallback( async ( requestedPage: number, query: string, startDate: string, endDate: string ) =>
    {
        setLoading( true );
        setError( null );
        const params = new URLSearchParams( { page: String( requestedPage ) } );
        if ( query.trim() ) params.set( 'search', query.trim() );
        if ( startDate ) params.set( 'from', startDate );
        if ( endDate ) params.set( 'to', endDate );

        try
        {
            const response = await fetch( `/api/admin/customers?${ params }`, { cache: 'no-store' } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not load customers.' );
            setCustomers( result.data || [] );
            setSummary( result.summary || { totalCustomers: 0, newToday: 0, newThisMonth: 0 } );
            setPage( result.pagination?.page || requestedPage );
            setTotalPages( Math.max( 1, result.pagination?.totalPages || 1 ) );
        } catch ( requestError )
        {
            setError( requestError instanceof Error ? requestError.message : 'Could not load customers.' );
        } finally
        {
            setLoading( false );
        }
    }, [] );

    useEffect( () =>
    {
        const timer = window.setTimeout( () => void loadCustomers( page, search, from, to ), 250 );
        return () => window.clearTimeout( timer );
    }, [ from, loadCustomers, page, search, to ] );

    function updateFilter ( setter: ( value: string ) => void, value: string )
    {
        setter( value );
        setPage( 1 );
    }

    return (
        <main className="shell py-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="eyebrow">Admin</p>
                    <h1 className="display mt-2 text-4xl">Customers</h1>
                </div>
            </div>

            <section className="mt-7 grid gap-3 sm:grid-cols-3">
                { [
                    [ 'Registered customers', summary.totalCustomers ],
                    [ 'New today', summary.newToday ],
                    [ 'New this month', summary.newThisMonth ],
                ].map( ( [ label, value ] ) => (
                    <article className="rounded-xl border border-stone/30 bg-white p-5" key={ label }>
                        <p className="text-xs uppercase tracking-wider text-zinc-500">{ label }</p>
                        <p className="display mt-2 text-3xl">{ value }</p>
                    </article>
                ) ) }
            </section>

            <section className="mt-7 grid gap-3 sm:grid-cols-[1fr_180px_180px]">
                <input className="input rounded-lg" placeholder="Search name, email or mobile" value={ search } onChange={ event => updateFilter( setSearch, event.target.value ) } />
                <label className="text-xs text-zinc-500">Registered from
                    <input className="input mt-1 rounded-lg" type="date" value={ from } onChange={ event => updateFilter( setFrom, event.target.value ) } />
                </label>
                <label className="text-xs text-zinc-500">Registered to
                    <input className="input mt-1 rounded-lg" type="date" value={ to } min={ from || undefined } onChange={ event => updateFilter( setTo, event.target.value ) } />
                </label>
            </section>

            <div className="mt-5 overflow-x-auto rounded-xl border border-stone/30 bg-white">
                { loading ? (
                    <div className="p-10 text-center text-zinc-400">Loading customers…</div>
                ) : error ? (
                    <div className="p-10 text-center text-red-700" role="alert">{ error }</div>
                ) : !customers.length ? (
                    <div className="p-10 text-center text-zinc-400">No registered customers match these filters.</div>
                ) : (
                    <table className="w-full min-w-[1100px] text-left text-sm">
                        <thead className="border-b border-stone bg-stone/20">
                            <tr>
                                { [ 'Customer', 'Email', 'Mobile', 'Orders', 'Delivered', 'Pending', 'Cancelled', 'Purchase value', 'Registered', 'Last order', 'History' ].map( heading => (
                                    <th key={ heading } className="p-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{ heading }</th>
                                ) ) }
                            </tr>
                        </thead>
                        <tbody>
                            { customers.map( customer => (
                                <Fragment key={ customer.userId }>
                                    <tr className="border-b border-stone/30 hover:bg-stone/10">
                                        <td className="p-4 font-semibold text-navy">{ customer.name || '—' }</td>
                                        <td className="p-4 text-zinc-600">{ customer.email }</td>
                                        <td className="p-4 text-zinc-600">{ customer.phone || '—' }</td>
                                        <td className="p-4">{ customer.orderCount }</td>
                                        <td className="p-4">{ customer.completedOrders }</td>
                                        <td className="p-4">{ customer.pendingOrders }</td>
                                        <td className="p-4">{ customer.cancelledOrders }</td>
                                        <td className="p-4 font-semibold text-gold">{ money( customer.totalSpent ) }</td>
                                        <td className="p-4 text-xs text-zinc-500">{ displayDate( customer.registeredAt ) }</td>
                                        <td className="p-4 text-xs text-zinc-500">{ displayDate( customer.lastOrderAt ) }</td>
                                        <td className="p-4">
                                            <button className="text-xs underline" type="button" onClick={ () => setExpandedCustomer( expandedCustomer === customer.userId ? null : customer.userId ) }>
                                                { expandedCustomer === customer.userId ? 'Hide' : 'View' }
                                            </button>
                                        </td>
                                    </tr>
                                    { expandedCustomer === customer.userId && (
                                        <tr>
                                            <td className="bg-stone/10 p-4" colSpan={ 11 }>
                                                { customer.orders.length ? (
                                                    <div className="space-y-2">
                                                        { customer.orders.map( order => (
                                                            <div className="flex flex-wrap justify-between gap-2 border-b border-stone/50 pb-2 text-xs" key={ order.id }>
                                                                <span>{ order.orderNumber } · { displayDate( order.createdAt ) }</span>
                                                                <span className="capitalize">{ order.orderStatus?.replaceAll( '_', ' ' ) } · payment { order.paymentStatus }</span>
                                                                <strong>{ money( order.total ) }</strong>
                                                            </div>
                                                        ) ) }
                                                    </div>
                                                ) : <p className="text-sm text-zinc-500">No orders have been placed. Cart activity is not counted as a purchase.</p> }
                                            </td>
                                        </tr>
                                    ) }
                                </Fragment>
                            ) ) }
                        </tbody>
                    </table>
                ) }
            </div>

            <div className="mt-4 flex items-center justify-between">
                <button className="button-outline" type="button" disabled={ loading || page <= 1 } onClick={ () => setPage( page - 1 ) }>Previous</button>
                <p className="text-sm text-zinc-500">Page { page } of { totalPages }</p>
                <button className="button-outline" type="button" disabled={ loading || page >= totalPages } onClick={ () => setPage( page + 1 ) }>Next</button>
            </div>
        </main>
    );
}
