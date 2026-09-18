'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Order = {
    _id: string;
    orderNumber: string;
    userEmail: string;
    finalAmount: number;
    orderStatus: string;
    paymentMethod: string;
    paymentStatus: string;
    shippingAddress: any;
    items: any[];
    createdAt: string;
};

const money = ( n: number ) => new Intl.NumberFormat( 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 } ).format( n );

export default function AdminOrders ()
{
    const [ orders, setOrders ] = useState<Order[]>( [] );
    const [ loading, setLoading ] = useState( true );
    const [ expandedId, setExpandedId ] = useState<string | null>( null );
    const [ search, setSearch ] = useState( '' );

    const fetchOrders = async () =>
    {
        setLoading( true );
        try
        {
            const res = await fetch( `/api/admin/orders?search=${ search }` );
            const json = await res.json();
            if ( json.data )
            {
                setOrders( json.data );
            }
        } catch ( e )
        {
            console.error( e );
        } finally
        {
            setLoading( false );
        }
    };

    useEffect( () =>
    {
        const delayBounceFn = setTimeout( () => fetchOrders(), 400 );
        return () => clearTimeout( delayBounceFn );
    }, [ search ] );

    const updateStatus = async ( orderId: string, status: string ) =>
    {
        try
        {
            await fetch( '/api/admin/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { orderId, orderStatus: status } )
            } );
            fetchOrders();
        } catch ( e )
        {
            alert( 'Failed to update order status' );
        }
    };

    return (
        <main className="shell py-12">
            <div className="flex items-center justify-between">
                <div>
                    <p className="eyebrow">Fulfilment</p>
                    <h1 className="display mt-2 text-5xl">Orders</h1>
                </div>
                <input
                    type="text"
                    placeholder="Search orders, emails, names..."
                    value={ search }
                    onChange={ ( e ) => setSearch( e.target.value ) }
                    className="border border-stone px-4 py-2 w-72 bg-white"
                />
            </div>

            <div className="mt-10 overflow-x-auto bg-white border border-stone">
                <table className="w-full text-left text-sm min-w-[1000px]">
                    <thead className="border-b border-stone text-[10px] uppercase tracking-wider text-zinc-500 bg-stone/20">
                        <tr>
                            <th className="p-4">Order Details</th>
                            <th className="p-4">Customer info & Address</th>
                            <th className="p-4">Items Summary</th>
                            <th className="p-4">Payment</th>
                            <th className="p-4">Status & Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        { loading ? (
                            <tr><td colSpan={ 5 } className="p-8 text-center text-zinc-500">Loading orders...</td></tr>
                        ) : orders.length === 0 ? (
                            <tr><td colSpan={ 5 } className="p-8 text-center text-zinc-500">No orders found.</td></tr>
                        ) : (
                            orders.map( order => (
                                <tr className="border-b border-stone align-top hover:bg-stone/10 transition-colors" key={ order._id }>
                                    <td className="p-4">
                                        <p className="font-semibold text-navy mb-1">{ order.orderNumber }</p>
                                        <p className="text-xs text-zinc-500">{ new Date( order.createdAt ).toLocaleString( 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } ) }</p>
                                        <button onClick={ () => setExpandedId( expandedId === order._id ? null : order._id ) } className="mt-3 text-[10px] uppercase tracking-widest text-navy underline decoration-navy/30 hover:decoration-navy">
                                            { expandedId === order._id ? 'Hide full details' : 'View full details' }
                                        </button>
                                    </td>

                                    <td className="p-4 max-w-[250px]">
                                        <p className="font-semibold">{ order.shippingAddress?.name }</p>
                                        <p className="text-xs text-navy underline truncate">{ order.userEmail }</p>
                                        <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
                                            { order.shippingAddress?.address }<br />
                                            { order.shippingAddress?.city }, { order.shippingAddress?.postalCode }<br />
                                            Ph: { order.shippingAddress?.phone }
                                        </p>
                                    </td>

                                    <td className="p-4">
                                        <p className="font-semibold mb-2">{ order.items?.length } { order.items?.length === 1 ? 'item' : 'items' }</p>
                                        <div className="space-y-2 max-h-24 overflow-y-auto pr-2">
                                            { order.items?.map( ( item, i ) => (
                                                <div key={ i } className="flex items-center gap-2 text-xs">
                                                    { item.image && <img src={ item.image } alt="" className="w-8 h-8 object-cover rounded bg-stone" /> }
                                                    <div className="flex-1 truncate">
                                                        <span className="font-medium">{ item.name }</span>
                                                        <span className="block text-zinc-500">{ item.size } • { item.color } • Qty: { item.quantity }</span>
                                                    </div>
                                                </div>
                                            ) ) }
                                        </div>
                                    </td>

                                    <td className="p-4">
                                        <p className="font-semibold text-lg">{ money( order.finalAmount ) }</p>
                                        <p className="text-xs mt-1">
                                            { order.paymentMethod === 'cod' ? (
                                                <span className="inline-block bg-orange-100 text-orange-800 px-2 py-0.5 rounded uppercase tracking-wider font-semibold text-[9px]">COD (Cash)</span>
                                            ) : (
                                                <span className="inline-block bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded uppercase tracking-wider font-semibold text-[9px]">Online (Razorpay)</span>
                                            ) }
                                        </p>
                                        <p className="text-[10px] text-zinc-500 mt-1 capitalize">Status: { order.paymentStatus }</p>
                                    </td>

                                    <td className="p-4">
                                        <div className="flex flex-col items-start gap-2">
                                            <span className={ `inline-block px-2.5 py-1 rounded text-xs font-semibold capitalize tracking-wide ${ order.orderStatus === 'delivered' ? 'bg-green-100 text-green-700' :
                                                    order.orderStatus === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                        'bg-blue-100 text-blue-700'
                                                }` }>
                                                { order.orderStatus }
                                            </span>

                                            <select
                                                value={ order.orderStatus }
                                                onChange={ ( e ) => updateStatus( order._id, e.target.value ) }
                                                className="mt-2 text-xs border border-stone bg-stone/20 rounded px-2 py-1 outline-none focus:border-navy"
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="processing">Processing</option>
                                                <option value="shipped">Shipped</option>
                                                <option value="delivered">Delivered</option>
                                                <option value="cancelled">Cancelled</option>
                                            </select>
                                        </div>
                                    </td>
                                </tr>
                            ) )
                        ) }
                    </tbody>
                </table>
            </div>
        </main>
    );
}
