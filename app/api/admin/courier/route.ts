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
        const { data, error } = await getSupabaseAdmin()
            .from( 'orders' )
            .select( 'id, order_number, created_at, order_status, payment_status, payment_method, final_amount, total_amount, shipping_cost, courier_name, tracking_number, courier_status, courier_status_updated_at, courier_shipping_charge, shipping_address, items, return_status, return_refund_amount' )
            .gte( 'created_at', since.toISOString() )
            .order( 'created_at', { ascending: false } )
            .limit( 200 );

        if ( error ) throw error;

        const orders = ( data || [] ).map( order => ( {
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
            customerName: order.shipping_address?.name || 'Customer',
            customerPhone: order.shipping_address?.phone || '',
            itemCount: Array.isArray( order.items )
                ? order.items.reduce( ( count: number, item: { quantity?: number } ) => count + Number( item.quantity || 0 ), 0 )
                : 0,
            returnStatus: order.return_status,
            returnRefundAmount: order.return_refund_amount === null ? null : Number( order.return_refund_amount ),
        } ) );

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
            summary: {
                periodDays: 30,
                totalOrders: orders.length,
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
                error: 'Courier fields are not installed in Supabase. Apply supabase/migrations/0013_courier_tracking.sql after migrations 0011 and 0012.',
            }, { status: 503 } );
        }
        return NextResponse.json( { error: 'Could not load courier dashboard.' }, { status: 500 } );
    }
}
