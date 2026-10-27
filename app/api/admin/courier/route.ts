import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase/db';

export async function GET ()
{
    try
    {
        if ( !await isAdminRequest() )
            return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const since = new Date();
        since.setDate( since.getDate() - 30 );
        const db = getSupabaseAdmin();
        const selection = 'id, order_number, created_at, order_status, payment_status, payment_method, final_amount, total_amount, shipping_cost, courier_name, tracking_number, courier_status, courier_status_updated_at, courier_shipping_charge, courier_dispatch_queued, shipping_address, user_email, email, items, return_status, return_refund_amount';
        const [ { data, error }, { data: queuedData, error: queuedError, count: queuedCount } ] = await Promise.all( [
            db.from( 'orders' )
                .select( selection, { count: 'exact' } )
                .gte( 'created_at', since.toISOString() )
                .order( 'created_at', { ascending: false } )
                .limit( 200 ),
            db.from( 'orders' )
                .select( selection )
                .eq( 'courier_dispatch_queued', true )
                .order( 'created_at', { ascending: false } )
                .limit( 200 ),
        ] );

        if ( error ) throw error;
        if ( queuedError ) throw queuedError;

        const mapOrder = ( order: NonNullable<typeof data>[number] ) => ( {
            id: order.id,
            orderNumber: order.order_number,
            createdAt: order.created_at,
            orderStatus: order.order_status,
            paymentStatus: order.payment_status,
            paymentMethod: order.payment_method,
            amount: Number( order.final_amount ?? order.total_amount ?? 0 ),
            deliveryCharge: Number( order.shipping_cost || 0 ),
            courierName: order.courier_name,
            trackingNumber: order.tracking_number,
            courierStatus: order.courier_status,
            courierStatusUpdatedAt: order.courier_status_updated_at,
            courierShippingCharge: order.courier_shipping_charge === null ? null : Number( order.courier_shipping_charge ),
            courierDispatchQueued: Boolean( order.courier_dispatch_queued ),
            customerName: order.shipping_address?.name || 'Customer',
            customerPhone: order.shipping_address?.phone || '',
            customerEmail: order.user_email || order.email || '',
            shippingAddress: order.shipping_address,
            items: Array.isArray( order.items ) ? order.items.map( ( item: Record<string, unknown> ) => ( {
                name: String( item.name || 'Product' ),
                quantity: Number( item.quantity || 0 ),
                size: item.size ? String( item.size ) : '',
                color: item.color ? String( item.color ) : '',
                sku: item.sku ? String( item.sku ) : '',
                unitPrice: Number( item.price || 0 ),
            } ) ) : [],
            itemCount: Array.isArray( order.items )
                ? order.items.reduce( ( count: number, item: { quantity?: number } ) => count + Number( item.quantity || 0 ), 0 )
                : 0,
            returnStatus: order.return_status,
            returnRefundAmount: order.return_refund_amount === null ? null : Number( order.return_refund_amount ),
        } );
        const orders = ( data || [] ).map( mapOrder );
        const queuedOrders = ( queuedData || [] ).map( mapOrder );

        const paymentCollected = orders.reduce( ( total, order ) =>
            order.paymentStatus === 'paid' ? total + order.amount : total, 0 );
        const refunds = orders.reduce( ( total, order ) =>
        {
            if ( order.returnStatus === 'refunded' )
                return total + Number( order.returnRefundAmount || 0 );
            return order.paymentStatus === 'refunded' ? total + order.amount : total;
        }, 0 );
        const courierChargesReported = orders.reduce( ( total, order ) =>
            total + Number( order.courierShippingCharge || 0 ), 0 );

        return NextResponse.json( {
            data: orders,
            queuedOrders,
            summary: {
                periodDays: 30,
                totalOrders: orders.length,
                awaitingCourierSubmission: queuedCount || 0,
                ordersWithoutAwb: orders.filter( order =>
                    !order.trackingNumber && String( order.orderStatus ).toLowerCase() !== 'cancelled'
                ).length,
                trackedShipments: orders.filter( order => Boolean( order.trackingNumber ) ).length,
                inTransit: orders.filter( order =>
                    Boolean( order.trackingNumber ) &&
                    /transit|picked.?up|manifest|out.for.delivery/i.test( order.courierStatus || '' )
                ).length,
                delivered: orders.filter( order =>
                    Boolean( order.trackingNumber ) && /delivered/i.test( order.courierStatus || '' )
                ).length,
                courierRto: orders.filter( order =>
                    Boolean( order.trackingNumber ) && /rto|return/i.test( order.courierStatus || '' )
                ).length,
                customerReturnCases: orders.filter( order => order.returnStatus !== null ).length,
                storeMarkedDelivered: orders.filter( order => String( order.orderStatus ).toLowerCase() === 'delivered' ).length,
                cancelled: orders.filter( order => String( order.orderStatus ).toLowerCase() === 'cancelled' ).length,
                paymentCollected,
                refunds,
                netReceipts: paymentCollected - refunds,
                courierChargesReported,
                ordersWithUnknownCourierCharge: orders.filter( order =>
                    Boolean( order.trackingNumber ) && order.courierShippingCharge === null
                ).length,
            },
            limit: 200,
        } );
    } catch ( error )
    {
        console.error( 'Admin courier dashboard GET error:', error );
        if (
            error && typeof error === 'object' &&
            'code' in error &&
            ( error.code === '42703' || error.code === 'PGRST204' || error.code === 'PGRST200' )
        )
        {
            return NextResponse.json( {
                error: 'Courier fields are not installed in Supabase. Apply migrations 0013_courier_tracking.sql and 0014_courier_dispatch_queue.sql after 0011 and 0012.',
            }, { status: 503 } );
        }
        return NextResponse.json( { error: 'Could not load courier dashboard.' }, { status: 500 } );
    }
}
