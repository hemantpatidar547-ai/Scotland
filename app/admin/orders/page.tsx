'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import BillingActions from '@/components/admin/BillingActions';

type Order = {
    _id: string;
    orderNumber: string;
    userEmail: string;
    finalAmount: number;
    orderStatus: string;
    paymentMethod: string;
    paymentStatus: string;
    subtotal: number;
    shippingCost: number;
    couponDiscount: number;
    tax: number;
    returnStatus: string | null;
    returnReason: string | null;
    returnItems: string[];
    returnRefundAmount: number | null;
    returnRequestedAt: string | null;
    shippingAddress: any;
    items: any[];
    createdAt: string;
    invoiceNumber?: string;
};

const money = ( n: number ) => new Intl.NumberFormat( 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 } ).format( n );

const getDateRange = ( preset: string ) =>
{
    const today = new Date();
    today.setHours( 0, 0, 0, 0 );
    const end = new Date( today );
    end.setHours( 23, 59, 59, 999 );

    if ( preset === 'today' ) return { from: today.toISOString(), to: end.toISOString() };
    if ( preset === 'yesterday' )
    {
        const yest = new Date( today );
        yest.setDate( today.getDate() - 1 );
        const yestEnd = new Date( yest );
        yestEnd.setHours( 23, 59, 59, 999 );
        return { from: yest.toISOString(), to: yestEnd.toISOString() };
    }
    if ( preset === 'this_week' )
    {
        const start = new Date( today );
        start.setDate( today.getDate() - today.getDay() );
        return { from: start.toISOString(), to: end.toISOString() };
    }
    if ( preset === 'this_month' )
    {
        const start = new Date( today.getFullYear(), today.getMonth(), 1 );
        return { from: start.toISOString(), to: end.toISOString() };
    }
    if ( preset === 'last_month' )
    {
        const start = new Date( today.getFullYear(), today.getMonth() - 1, 1 );
        const lEnd = new Date( today.getFullYear(), today.getMonth(), 0 );
        lEnd.setHours( 23, 59, 59, 999 );
        return { from: start.toISOString(), to: lEnd.toISOString() };
    }
    if ( preset === 'this_year' )
    {
        const start = new Date( today.getFullYear(), 0, 1 );
        return { from: start.toISOString(), to: end.toISOString() };
    }
    return { from: '', to: '' };
};

export default function AdminOrders ()
{
    const [ orders, setOrders ] = useState<Order[]>( [] );
    const [ loading, setLoading ] = useState( true );
    const [ expandedId, setExpandedId ] = useState<string | null>( null );
    const [ updatingOrderIds, setUpdatingOrderIds ] = useState<Set<string>>( new Set() );

    // Filters State
    const [ search, setSearch ] = useState( '' );
    const [ datePreset, setDatePreset ] = useState( 'this_month' );
    const [ customFrom, setCustomFrom ] = useState( '' );
    const [ customTo, setCustomTo ] = useState( '' );
    const [ statusFilter, setStatusFilter ] = useState( 'all' );

    // Pagination & Stats
    const [ page, setPage ] = useState( 1 );
    const [ totalPages, setTotalPages ] = useState( 1 );
    const [ totalItems, setTotalItems ] = useState( 0 );
    const [ summary, setSummary ] = useState<any>( null );

    const fetchOrders = useCallback( async ( showLoading = true ) =>
    {
        if ( showLoading ) setLoading( true );
        try
        {
            let qs = `?page=${ page }&limit=20`;
            if ( search ) qs += `&search=${ encodeURIComponent( search ) }`;
            if ( statusFilter !== 'all' ) qs += `&status=${ statusFilter }`;

            let fd = '', td = '';
            if ( datePreset === 'custom' )
            {
                if ( customFrom )
                {
                    const date = new Date( customFrom );
                    date.setHours( 0, 0, 0, 0 );
                    fd = date.toISOString();
                }
                if ( customTo )
                {
                    const date = new Date( customTo );
                    date.setHours( 23, 59, 59, 999 );
                    td = date.toISOString();
                }
            } else if ( datePreset !== 'all' )
            {
                const range = getDateRange( datePreset );
                fd = range.from;
                td = range.to;
            }

            if ( fd ) qs += `&from_date=${ fd }`;
            if ( td ) qs += `&to_date=${ td }`;

            const res = await fetch( `/api/admin/orders${ qs }` );
            const json = await res.json();

            if ( json.data )
            {
                setOrders( json.data );
                setTotalPages( json.totalPages );
                setTotalItems( json.total );
                setSummary( json.summary );
            }
        } catch ( e )
        {
            console.error( e );
        } finally
        {
            if ( showLoading ) setLoading( false );
        }
    }, [ page, search, statusFilter, datePreset, customFrom, customTo ] );

    useEffect( () =>
    {
        const delayBounceFn = setTimeout( () =>
        {
            fetchOrders();
        }, 400 );
        return () => clearTimeout( delayBounceFn );
    }, [ fetchOrders ] );

    // Reset page to 1 when filters change (but not when page changes)
    useEffect( () =>
    {
        setPage( 1 );
    }, [ search, statusFilter, datePreset, customFrom, customTo ] );

    const updateStatus = async ( orderId: string, status: string ) =>
    {
        const order = orders.find( item => item._id === orderId );
        if ( !order || order.orderStatus === status ) return;

        const previousStatus = order.orderStatus;
        setOrders( currentOrders => currentOrders.map( item =>
            item._id === orderId ? { ...item, orderStatus: status } : item
        ) );
        setUpdatingOrderIds( currentIds => new Set( currentIds ).add( orderId ) );

        try
        {
            const response = await fetch( '/api/admin/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { orderId, orderStatus: status } )
            } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Failed to update order status' );

            await fetchOrders( false );
        } catch ( e )
        {
            setOrders( currentOrders => currentOrders.map( item =>
                item._id === orderId ? { ...item, orderStatus: previousStatus } : item
            ) );
            alert( e instanceof Error ? e.message : 'Failed to update order status' );
        } finally
        {
            setUpdatingOrderIds( currentIds =>
            {
                const nextIds = new Set( currentIds );
                nextIds.delete( orderId );
                return nextIds;
            } );
        }
    };

    const updatePaymentStatus = async ( orderId: string, status: string ) =>
    {
        const order = orders.find( item => item._id === orderId );
        if ( !order || order.paymentStatus === status ) return;
        if ( status === 'refunded' && !window.confirm( 'Only mark this payment refunded after you have completed the refund in your payment provider. Continue?' ) ) return;

        const previousStatus = order.paymentStatus;
        setOrders( currentOrders => currentOrders.map( item =>
            item._id === orderId ? { ...item, paymentStatus: status } : item
        ) );
        setUpdatingOrderIds( currentIds => new Set( currentIds ).add( orderId ) );

        try
        {
            const response = await fetch( '/api/admin/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { orderId, paymentStatus: status } ),
            } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Failed to update payment status' );
            await fetchOrders( false );
        } catch ( cause )
        {
            setOrders( currentOrders => currentOrders.map( item =>
                item._id === orderId ? { ...item, paymentStatus: previousStatus } : item
            ) );
            alert( cause instanceof Error ? cause.message : 'Failed to update payment status' );
        } finally
        {
            setUpdatingOrderIds( currentIds =>
            {
                const nextIds = new Set( currentIds );
                nextIds.delete( orderId );
                return nextIds;
            } );
        }
    };

    const updateReturnStatus = async ( orderId: string, status: string ) =>
    {
        const order = orders.find( item => item._id === orderId );
        if ( !order || order.returnStatus === status ) return;
        if ( status === 'refunded' && !window.confirm( `Confirm you have completed the ₹${ Number( order.returnRefundAmount || 0 ).toLocaleString( 'en-IN' ) } refund outside this dashboard before marking it refunded.` ) ) return;

        const previousStatus = order.returnStatus;
        const previousPaymentStatus = order.paymentStatus;
        setOrders( currentOrders => currentOrders.map( item =>
            item._id === orderId ? {
                ...item,
                returnStatus: status,
                paymentStatus: status === 'refunded' ? 'refunded' : item.paymentStatus,
            } : item
        ) );
        setUpdatingOrderIds( currentIds => new Set( currentIds ).add( orderId ) );

        try
        {
            const response = await fetch( '/api/admin/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { orderId, returnStatus: status } ),
            } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Failed to update return status' );
            await fetchOrders( false );
        } catch ( cause )
        {
            setOrders( currentOrders => currentOrders.map( item =>
                item._id === orderId ? { ...item, returnStatus: previousStatus, paymentStatus: previousPaymentStatus } : item
            ) );
            alert( cause instanceof Error ? cause.message : 'Failed to update return status' );
        } finally
        {
            setUpdatingOrderIds( currentIds =>
            {
                const nextIds = new Set( currentIds );
                nextIds.delete( orderId );
                return nextIds;
            } );
        }
    };

    const handleClearFilters = () =>
    {
        setDatePreset( 'this_month' );
        setCustomFrom( '' );
        setCustomTo( '' );
        setStatusFilter( 'all' );
        setSearch( '' );
        setPage( 1 );
    };

    return (
        <main className="shell py-8">
            {/* Header */ }
            <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-stone pb-6 mb-6 gap-4">
                <div>
                    <h1 className="display text-4xl text-navy">Order Management</h1>
                    <p className="text-sm text-zinc-500 mt-2">Manage fulfillments, billing, and order histories.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="text"
                        placeholder="Search ID, Name, Phone, Email..."
                        value={ search }
                        onChange={ ( e ) => setSearch( e.target.value ) }
                        className="border border-stone px-4 py-2 w-72 bg-white text-sm focus:outline-none focus:border-navy"
                    />
                    <button onClick={ handleClearFilters } className="text-xs uppercase tracking-wider font-semibold text-zinc-500 hover:text-navy underline">
                        Clear Filters
                    </button>
                </div>
            </div>

            {/* Filters Section */ }
            <div className="bg-stone-50 p-4 border border-stone rounded flex flex-wrap items-center gap-4 mb-6 text-sm">
                <div className="flex items-center gap-2">
                    <label className="font-semibold text-zinc-700">Date Range:</label>
                    <select
                        value={ datePreset }
                        onChange={ ( e ) => setDatePreset( e.target.value ) }
                        className="p-2 border border-stone rounded bg-white outline-none focus:border-navy"
                    >
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="this_week">This Week</option>
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="this_year">This Year</option>
                        <option value="custom">Custom Range</option>
                    </select>
                </div>

                { datePreset === 'custom' && (
                    <div className="flex items-center gap-2">
                        <input type="date" value={ customFrom } onChange={ e => setCustomFrom( e.target.value ) } className="p-2 border border-stone rounded bg-white outline-none" />
                        <span className="text-zinc-400">to</span>
                        <input type="date" value={ customTo } onChange={ e => setCustomTo( e.target.value ) } className="p-2 border border-stone rounded bg-white outline-none" />
                    </div>
                ) }

                <div className="flex items-center gap-2 ml-auto">
                    <label className="font-semibold text-zinc-700">Order Status:</label>
                    <select
                        value={ statusFilter }
                        onChange={ ( e ) => setStatusFilter( e.target.value ) }
                        className="p-2 border border-stone rounded bg-white outline-none focus:border-navy"
                    >
                        <option value="all">All Orders</option>
                        <option value="new">New / Just Ordered</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="processing">Processing</option>
                        <option value="packed">Packed</option>
                        <option value="shipped">Shipped</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="delivered">Delivered / Successful</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="returned">Returned</option>
                        <option value="refunded">Refunded</option>
                    </select>
                </div>
            </div>

            {/* Configurable Dashboard Summary Cards */ }
            { summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
                    <div className="bg-white p-4 border border-stone rounded shadow-sm text-center">
                        <p className="text-xl font-bold text-navy">{ summary.totalOrders }</p>
                        <p className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Total Orders</p>
                    </div>
                    <div className="bg-white p-4 border border-stone rounded shadow-sm text-center">
                        <p className="text-xl font-bold text-emerald-600">{ money( summary.totalSales ) }</p>
                        <p className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Total Sales</p>
                    </div>
                    <div className="bg-white p-4 border border-stone rounded shadow-sm text-center">
                        <p className="text-xl font-bold text-blue-600">{ summary.pendingOrders }</p>
                        <p className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Pending Orders</p>
                    </div>
                    <div className="bg-white p-4 border border-stone rounded shadow-sm text-center">
                        <p className="text-xl font-bold text-orange-600">{ summary.processingOrders + summary.shippedOrders }</p>
                        <p className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Processing / Shipped</p>
                    </div>
                    <div className="bg-white p-4 border border-stone rounded shadow-sm text-center">
                        <p className="text-xl font-bold text-green-600">{ summary.deliveredOrders }</p>
                        <p className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Delivered</p>
                    </div>
                </div>
            ) }


            <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-semibold text-zinc-600">
                    Showing { orders.length > 0 ? ( ( page - 1 ) * 20 ) + 1 : 0 }–{ Math.min( page * 20, totalItems ) } of { totalItems } orders
                </p>
                <div className="flex items-center gap-2">
                    <button
                        disabled={ page <= 1 }
                        onClick={ () => setPage( p => p - 1 ) }
                        className="px-3 py-1 bg-stone-100 border border-stone rounded disabled:opacity-50 text-sm hover:bg-stone-200"
                    >Prev</button>
                    <span className="text-sm font-semibold mx-2">{ page } / { totalPages || 1 }</span>
                    <button
                        disabled={ page >= totalPages }
                        onClick={ () => setPage( p => p + 1 ) }
                        className="px-3 py-1 bg-stone-100 border border-stone rounded disabled:opacity-50 text-sm hover:bg-stone-200"
                    >Next</button>
                </div>
            </div>

            <div className="overflow-x-auto bg-white border border-stone rounded">
                <table className="w-full text-left text-sm min-w-[1000px]">
                    <thead className="border-b border-stone text-[10px] uppercase tracking-wider text-zinc-500 bg-stone/20">
                        <tr>
                            <th className="p-4 w-1/5">Order Info</th>
                            <th className="p-4 w-1/4">Customer & City</th>
                            <th className="p-4 w-1/4">Products</th>
                            <th className="p-4 w-1/6">Totals & Pay</th>
                            <th className="p-4 text-right">Status / Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        { loading ? (
                            <tr><td colSpan={ 5 } className="p-12 text-center text-zinc-500 font-semibold tracking-wide">Loading orders...</td></tr>
                        ) : orders.length === 0 ? (
                            <tr><td colSpan={ 5 } className="p-12 text-center text-zinc-500 font-semibold tracking-wide">No orders match the current filters.</td></tr>
                        ) : (
                            orders.map( order => (
                                <React.Fragment key={ order._id }>
                                    <tr className={ `border-b border-stone align-top hover:bg-stone/10 transition-colors ${ expandedId === order._id ? 'bg-stone-50' : '' }` }>
                                        <td className="p-4">
                                            <p className="font-semibold text-navy mb-1">{ order.orderNumber }</p>
                                            <p className="text-xs text-zinc-500">{ new Date( order.createdAt ).toLocaleString( 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } ) }</p>
                                        </td>

                                        <td className="p-4">
                                            <p className="font-semibold">{ order.shippingAddress?.name }</p>
                                            <p className="text-xs text-zinc-600 font-mono mt-1">{ order.shippingAddress?.phone }</p>
                                            <p className="text-xs text-navy mt-1 truncate max-w-[200px]">{ order.userEmail }</p>
                                            <p className="text-xs font-semibold text-zinc-500 mt-2">City: { order.shippingAddress?.city }</p>
                                        </td>

                                        <td className="p-4">
                                            <p className="text-xs font-bold mb-2 text-zinc-600">{ order.items?.length } items</p>
                                            <div className="space-y-2 max-h-24 overflow-y-auto pr-2">
                                                { order.items?.map( ( item, i ) => (
                                                    <div key={ i } className="flex items-center gap-2 text-xs border-b border-stone/30 pb-2 last:border-0 last:pb-0">
                                                        <div className="flex-1">
                                                            <span className="font-semibold block truncate" title={ item.name }>{ item.name }</span>
                                                            <span className="text-zinc-500">Qty: { item.quantity } | { item.size } | { item.color }</span>
                                                        </div>
                                                    </div>
                                                ) ) }
                                            </div>
                                        </td>

                                        <td className="p-4">
                                            <p className="font-bold text-lg text-emerald-700 mb-1">{ money( order.finalAmount ) }</p>
                                            <div className="text-[10px] font-bold uppercase tracking-wider">
                                                { order.paymentMethod === 'cod' ? (
                                                    <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded mr-1">COD</span>
                                                ) : (
                                                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded mr-1">ONLINE</span>
                                                ) }
                                                <span className={ order.paymentStatus === 'paid' ? 'text-green-600' : 'text-zinc-500' }>
                                                    ({ order.paymentStatus })
                                                </span>
                                            </div>
                                        </td>

                                        <td className="p-4 text-right">
                                            <div className="flex flex-col items-end gap-3">
                                                <select
                                                    value={ order.orderStatus }
                                                    onChange={ ( e ) => updateStatus( order._id, e.target.value ) }
                                                    disabled={ updatingOrderIds.has( order._id ) }
                                                    className={ `text-xs font-semibold border border-stone rounded px-3 py-1.5 outline-none cursor-pointer focus:border-navy capitalize ${ order.orderStatus === 'delivered' ? 'bg-green-100 text-green-800' :
                                                        order.orderStatus === 'cancelled' || order.orderStatus === 'returned' ? 'bg-red-100 text-red-800' :
                                                            'bg-stone-100 text-navy'
                                                        } ${ updatingOrderIds.has( order._id ) ? 'opacity-60 cursor-wait' : '' }` }
                                                >
                                                    <option value="new">New</option>
                                                    <option value="pending">Pending</option>
                                                    <option value="confirmed">Confirmed</option>
                                                    <option value="processing">Processing</option>
                                                    <option value="packed">Packed</option>
                                                    <option value="shipped">Shipped</option>
                                                    <option value="out_for_delivery">Out for Delivery</option>
                                                    <option value="delivered">Delivered</option>
                                                    <option value="cancelled">Cancelled</option>
                                                    <option value="returned">Returned</option>
                                                    <option value="refunded">Refunded</option>
                                                </select>
                                                <label className="flex flex-col items-end gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                                                    Payment
                                                    <select
                                                        value={ order.paymentStatus || 'pending' }
                                                        onChange={ event => void updatePaymentStatus( order._id, event.target.value ) }
                                                        disabled={ updatingOrderIds.has( order._id ) }
                                                        className="text-xs font-semibold normal-case tracking-normal border border-stone rounded px-3 py-1.5 outline-none cursor-pointer focus:border-navy capitalize disabled:opacity-60"
                                                    >
                                                        <option value="pending">Pending</option>
                                                        <option value="paid">Paid</option>
                                                        <option value="failed">Failed</option>
                                                        <option value="refunded">Refunded</option>
                                                    </select>
                                                </label>
                                                { order.orderStatus === 'cancelled' && order.paymentStatus === 'paid' && (
                                                    <span className="max-w-48 text-right text-[10px] leading-4 text-amber-700">Online refund is still pending; update this after refunding in Razorpay.</span>
                                                ) }
                                                { order.returnStatus && (
                                                    <div className="w-52 border-t border-stone pt-2 text-right">
                                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Return: { order.returnStatus }</p>
                                                        { order.returnItems.length > 0 && <p className="mt-1 text-left text-[10px] leading-4 text-zinc-600">Products: { order.returnItems.join( ', ' ) }</p> }
                                                        { order.returnRefundAmount !== null && <p className="mt-1 text-xs">Est. refund: { money( Number( order.returnRefundAmount || 0 ) ) }</p> }
                                                        { order.returnReason && <p className="mt-1 text-left text-[10px] leading-4 text-zinc-600">Reason: { order.returnReason }</p> }
                                                        { order.returnStatus === 'requested' && <div className="mt-2 flex justify-end gap-2">
                                                            <button type="button" className="text-xs text-emerald-700 underline" disabled={ updatingOrderIds.has( order._id ) } onClick={ () => void updateReturnStatus( order._id, 'approved' ) }>Approve</button>
                                                            <button type="button" className="text-xs text-rose-700 underline" disabled={ updatingOrderIds.has( order._id ) } onClick={ () => void updateReturnStatus( order._id, 'rejected' ) }>Reject</button>
                                                        </div> }
                                                        { order.returnStatus === 'approved' && <button type="button" className="mt-2 text-xs text-navy underline" disabled={ updatingOrderIds.has( order._id ) } onClick={ () => void updateReturnStatus( order._id, 'received' ) }>Mark return received &amp; inspected</button> }
                                                        { order.returnStatus === 'received' && <button type="button" className="mt-2 text-xs text-emerald-700 underline" disabled={ updatingOrderIds.has( order._id ) } onClick={ () => void updateReturnStatus( order._id, 'refunded' ) }>Mark manual refund complete</button> }
                                                        { order.returnStatus === 'refunded' && <p className="mt-1 text-xs text-emerald-700">Refund marked complete</p> }
                                                    </div>
                                                ) }

                                                <button
                                                    onClick={ () => setExpandedId( expandedId === order._id ? null : order._id ) }
                                                    className="text-[11px] font-bold uppercase tracking-widest text-navy bg-navy/10 px-3 py-1.5 rounded hover:bg-navy/20 transition"
                                                >
                                                    { expandedId === order._id ? 'Close Details' : 'View Full Details' }
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expanded Full Order Details Section */ }
                                    { expandedId === order._id && (
                                        <tr className="bg-stone-50 border-b-2 border-navy print:hidden">
                                            <td colSpan={ 5 } className="p-6">
                                                <div className="bg-white border border-stone rounded-md p-6 shadow-sm">

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                                        {/* Customer Details Block */ }
                                                        <div>
                                                            <h4 className="uppercase text-[10px] font-bold tracking-widest text-zinc-400 mb-3 border-b border-stone pb-2">Customer & Shipping Information</h4>
                                                            <div className="text-sm space-y-2">
                                                                <p><span className="font-semibold w-24 inline-block text-zinc-500">Name:</span> { order.shippingAddress?.name }</p>
                                                                <p><span className="font-semibold w-24 inline-block text-zinc-500">Mobile:</span> { order.shippingAddress?.phone }</p>
                                                                <p><span className="font-semibold w-24 inline-block text-zinc-500">Email:</span> { order.userEmail }</p>
                                                                <p className="flex items-start">
                                                                    <span className="font-semibold w-24 inline-block text-zinc-500 shrink-0">Address:</span>
                                                                    <span>
                                                                        { order.shippingAddress?.address }<br />
                                                                        { order.shippingAddress?.city }, { order.shippingAddress?.state }<br />
                                                                        { order.shippingAddress?.country || 'India' } - { order.shippingAddress?.postalCode }
                                                                    </span>
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Order Pricing Block */ }
                                                        <div>
                                                            <h4 className="uppercase text-[10px] font-bold tracking-widest text-zinc-400 mb-3 border-b border-stone pb-2">Financial Breakdown</h4>
                                                            <div className="text-sm space-y-2">
                                                                <p><span className="font-semibold w-32 inline-block text-zinc-500">Gross Total:</span> { money( order.items?.reduce( ( acc: number, cur: any ) => acc + ( cur.price * cur.quantity ), 0 ) ) }</p>
                                                                <p><span className="font-semibold w-32 inline-block text-zinc-500">Discount:</span> ₹0.00</p>
                                                                <p><span className="font-semibold w-32 inline-block text-zinc-500">Shipping / Extra:</span> ₹50.00</p>
                                                                <p><span className="font-semibold w-32 inline-block text-zinc-500">Tax/GST:</span> Inclusive</p>
                                                                <div className="border-t border-stone pt-2 mt-2">
                                                                    <p><span className="font-semibold w-32 inline-block text-navy">Final Net Total:</span> <span className="font-bold text-lg text-emerald-700">{ money( order.finalAmount ) }</span></p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <BillingActions order={ order } onInvoiceGenerated={ fetchOrders } />

                                                </div>
                                            </td>
                                        </tr>
                                    ) }
                                </React.Fragment>
                            ) )
                        ) }
                    </tbody>
                </table>
            </div>

            {/* Bottom Pagination */ }
            { totalPages > 1 && (
                <div className="mt-8 flex justify-center">
                    <div className="flex items-center gap-2">
                        <button
                            disabled={ page <= 1 }
                            onClick={ () => setPage( p => p - 1 ) }
                            className="px-4 py-2 bg-white border border-stone rounded text-sm hover:bg-stone-100 disabled:opacity-50"
                        >Populate Prev</button>
                        <span className="font-bold bg-navy text-white px-4 py-2 rounded">{ page }</span>
                        <button
                            disabled={ page >= totalPages }
                            onClick={ () => setPage( p => p + 1 ) }
                            className="px-4 py-2 bg-white border border-stone rounded text-sm hover:bg-stone-100 disabled:opacity-50"
                        >Load Next</button>
                    </div>
                </div>
            ) }
        </main>
    );
}
