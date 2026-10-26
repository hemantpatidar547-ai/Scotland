import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/ssr-server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { CancelOrderButton } from '@/components/customer/CancelOrderButton';
import { ReturnOrderForm } from '@/components/customer/ReturnOrderForm';

type OrderItemSnapshot = {
    productId?: string;
    name?: string;
    image?: string;
    size?: string;
    color?: string;
    quantity?: number;
    price?: number;
    totalPrice?: number;
};

export default async function OrderDetail ( { params }: { params: Promise<{ id: string }> } )
{
    const { id } = await params;
    const auth = await createClient();
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if ( authError || !user ) redirect( '/login?redirect=%2Faccount%2Forders' );

    const db = getSupabaseAdmin();
    const query = db.from( 'orders' )
        .select( 'id, order_number, created_at, order_status, payment_status, payment_method, shipping_address, tracking_number, courier_name, courier_status, courier_status_updated_at, subtotal, shipping_cost, coupon_discount, final_amount, total_amount, items, delivered_at, return_status, return_reason, return_item_indexes, return_requested_at, return_refund_amount' )
        .eq( 'user_id', user.id );
    const { data: order, error } = /^[0-9a-f-]{36}$/i.test( id )
        ? await query.eq( 'id', id ).maybeSingle()
        : await query.eq( 'order_number', id ).maybeSingle();
    if ( error )
    {
        console.error( 'Customer order detail fetch failed:', error );
        throw new Error( 'Could not load order details.' );
    }
    if ( !order ) notFound();

    const items = ( order.items || [] ) as OrderItemSnapshot[];
    const steps = [ 'pending', 'paid', 'processing', 'packed', 'shipped', 'delivered' ];
    const currentStatus = String( order.order_status || 'pending_payment' ).toLowerCase();
    const statusIndex = steps.indexOf( currentStatus === 'pending_payment' ? 'pending' : currentStatus );
    const total = Number( order.final_amount ?? order.total_amount ?? 0 );
    const canCancel = [ 'pending_payment', 'pending', 'new', 'paid', 'confirmed', 'processing', 'packed' ].includes( currentStatus );
    const deliveredAt = order.delivered_at ? new Date( order.delivered_at ).getTime() : null;
    const returnWindowOpen = currentStatus === 'delivered' && deliveredAt !== null && Date.now() <= deliveredAt + 48 * 60 * 60 * 1000;

    return (
        <main className="shell py-12">
            <Link href="/account/orders" className="text-sm underline">← Back to my orders</Link>
            <p className="eyebrow mt-8">Order { order.order_number }</p>
            <h1 className="display mt-2 text-5xl">Order details</h1>
            <p className="mt-3 text-sm text-zinc-600">Placed { new Date( order.created_at ).toLocaleString( 'en-IN' ) }</p>

            { order.order_status === 'cancelled' ? (
                <div className="mt-8 rounded border border-red-200 bg-red-50 p-4 text-red-800">
                    <p>This order has been cancelled.</p>
                    { order.payment_method !== 'cod' && order.payment_status === 'paid' && <p className="mt-2 text-sm">Your online payment is still marked as paid. The store admin must process the refund manually; it is not automatic.</p> }
                </div>
            ) : (
                <div className="mt-8 grid gap-3 sm:grid-cols-5">
                    { steps.map( ( step, index ) => (
                        <div key={ step } className={ `p-4 ${ statusIndex >= index ? 'bg-navy text-white' : 'bg-white text-zinc-500' }` }>
                            <p className="eyebrow">0{ index + 1 }</p>
                            <p className="mt-2 text-sm font-semibold capitalize">{ step }</p>
                        </div>
                    ) ) }
                </div>
            ) }

            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
                <section className="divide-y divide-stone border-y border-stone bg-white">
                    { items.map( ( item, index ) => (
                        <article className="flex gap-4 p-5" key={ `${ item.productId || item.name }-${ index }` }>
                            <div className="relative h-28 w-20 shrink-0 bg-stone">
                                <Image src={ item.image || '/images/brand/scotland-lion.png' } alt={ item.name || 'Purchased product' } fill className="object-cover" sizes="80px" />
                            </div>
                            <div className="flex flex-1 justify-between gap-3">
                                <div>
                                    <h2 className="font-semibold">{ item.name || 'Product' }</h2>
                                    <p className="mt-1 text-sm text-zinc-500">{ item.color } · { item.size } · Qty { item.quantity || 1 }</p>
                                </div>
                                <p className="font-medium">₹{ Number( item.totalPrice ?? Number( item.price || 0 ) * Number( item.quantity || 1 ) ).toLocaleString( 'en-IN' ) }</p>
                            </div>
                        </article>
                    ) ) }
                </section>

                <aside className="h-fit space-y-5 bg-white p-6">
                    <div>
                        <h2 className="display text-2xl">Payment & total</h2>
                        <p className="mt-3 text-sm capitalize">Payment status: { order.payment_status || 'pending' }</p>
                        { order.payment_method && <p className="mt-1 text-sm capitalize">Method: { order.payment_method }</p> }
                        <p className="mt-4 flex justify-between text-sm"><span>Subtotal</span><span>₹{ Number( order.subtotal || 0 ).toLocaleString( 'en-IN' ) }</span></p>
                        <p className="mt-2 flex justify-between text-sm"><span>Delivery</span><span>₹{ Number( order.shipping_cost || 0 ).toLocaleString( 'en-IN' ) }</span></p>
                        { Number( order.coupon_discount || 0 ) > 0 && <p className="mt-2 flex justify-between text-sm"><span>Discount</span><span>−₹{ Number( order.coupon_discount ).toLocaleString( 'en-IN' ) }</span></p> }
                        <p className="mt-4 flex justify-between border-t border-stone pt-4 font-semibold"><span>Total</span><span>₹{ total.toLocaleString( 'en-IN' ) }</span></p>
                    </div>
                    <div className="border-t border-stone pt-5">
                        <h2 className="font-semibold">Delivery address</h2>
                        <p className="mt-2 text-sm text-zinc-600">
                            { order.shipping_address?.name }<br />
                            { order.shipping_address?.address }<br />
                            { order.shipping_address?.city } { order.shipping_address?.postalCode }<br />
                            { order.shipping_address?.phone }
                        </p>
                    </div>
                    { ( order.tracking_number || order.courier_status ) && <div className="border-t border-stone pt-5">
                        <h2 className="font-semibold">Delivery tracking</h2>
                        { order.courier_name && <p className="mt-2 text-sm">{ order.courier_name }</p> }
                        { order.tracking_number && <p className="mt-1 text-sm">AWB / Tracking: { order.tracking_number }</p> }
                        { order.courier_status && <p className="mt-1 text-sm">Latest saved status: <span className="font-medium">{ order.courier_status }</span></p> }
                        { order.courier_status_updated_at && <p className="mt-1 text-xs text-zinc-500">Updated { new Date( order.courier_status_updated_at ).toLocaleString( 'en-IN' ) }</p> }
                        <p className="mt-2 text-xs text-zinc-500">Tracking updates are shown when the store receives and saves them.</p>
                    </div> }
                    { canCancel && <CancelOrderButton orderId={ order.id } prepaid={ order.payment_method !== 'cod' && order.payment_status === 'paid' } /> }
                    { order.return_status ? (
                        <div className="mt-5 border-t border-stone pt-5">
                            <h2 className="font-semibold">Return status: <span className="capitalize">{ String( order.return_status ).replaceAll( '_', ' ' ) }</span></h2>
                            { Array.isArray( order.return_item_indexes ) && <p className="mt-2 text-sm text-zinc-600">Products: { order.return_item_indexes.map( ( index: number ) => items[ index ]?.name || 'Product' ).join( ', ' ) }</p> }
                            { order.return_reason && <p className="mt-2 text-sm text-zinc-600">Reason: { order.return_reason }</p> }
                            { Number.isFinite( Number( order.return_refund_amount ) ) && <p className="mt-2 text-sm">Estimated refund: ₹{ Number( order.return_refund_amount || 0 ).toLocaleString( 'en-IN' ) }</p> }
                            { order.return_status === 'requested' && <p className="mt-2 text-xs text-zinc-500">The store will review your request. Refund is processed after the return is received and checked.</p> }
                            { order.return_status === 'refunded' && <p className="mt-2 text-xs text-emerald-700">The store has marked the refund as processed.</p> }
                        </div>
                    ) : returnWindowOpen ? (
                        <ReturnOrderForm
                            orderId={ order.id }
                            items={ items }
                            couponDiscount={ Number( order.coupon_discount || 0 ) }
                            orderTotal={ total }
                            deliveryCharge={ Number( order.shipping_cost || 0 ) }
                        />
                    ) : currentStatus === 'delivered' && deliveredAt !== null ? (
                        <p className="mt-5 border-t border-stone pt-5 text-xs text-zinc-500">The 48-hour return window has ended.</p>
                    ) : null }
                </aside>
            </div>
        </main>
    );
}
