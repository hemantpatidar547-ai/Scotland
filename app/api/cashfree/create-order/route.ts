import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/ssr-server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { checkoutCartSchema, checkoutShippingAddressSchema, getCheckoutShippingCost, priceCheckoutCart } from '@/lib/order-checkout';
import { enforceRateLimit } from '@/lib/rate-limit';
import { DelhiveryServiceError, getDelhiveryDeliveryEstimate } from '@/lib/delhivery/serviceability';
import { getOrderControlStatus, OrderControlUnavailableError } from '@/lib/order-control';
import { getCashfreeCheckoutMode, getCashfreeClient } from '@/lib/cashfree';

const requestSchema = z.object( {
    checkoutKey: z.string().uuid(),
    cartItems: checkoutCartSchema,
    shippingAddress: checkoutShippingAddressSchema,
    returnPolicyAccepted: z.literal( true ),
} );

function getFingerprint ( userId: string | null, cart: unknown, shippingAddress: unknown )
{
    return createHash( 'sha256' )
        .update( JSON.stringify( { userId, cart, shippingAddress } ) )
        .digest( 'hex' );
}

function isSameOrigin ( request: NextRequest )
{
    const origin = request.headers.get( 'origin' );
    return !origin || origin === request.nextUrl.origin;
}

function getReturnUrl ( request: NextRequest )
{
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if ( !configuredSiteUrl &&
        request.nextUrl.hostname !== 'localhost' &&
        request.nextUrl.hostname !== '127.0.0.1' )
        throw new Error( 'NEXT_PUBLIC_SITE_URL must be configured for Cashfree in deployed environments.' );
    const siteUrl = configuredSiteUrl ? new URL( configuredSiteUrl ) : request.nextUrl;
    if ( siteUrl.protocol !== 'https:' &&
        siteUrl.hostname !== 'localhost' &&
        siteUrl.hostname !== '127.0.0.1' )
        throw new Error( 'NEXT_PUBLIC_SITE_URL must use HTTPS outside local development.' );
    return new URL( '/checkout', siteUrl );
}

export async function POST ( request: NextRequest )
{
    if ( !isSameOrigin( request ) )
        return NextResponse.json( { error: 'Invalid request origin.' }, { status: 403 } );

    try
    {
        const rateLimitResponse = await enforceRateLimit( request, {
            scope: 'cashfree-create-order',
            limit: 10,
            windowSeconds: 60,
        } );
        if ( rateLimitResponse ) return rateLimitResponse;

        const orderControl = await getOrderControlStatus();
        if ( orderControl.orderPaused )
            return NextResponse.json(
                { error: orderControl.orderPauseMessage, code: 'ORDERS_PAUSED' },
                { status: 409 }
            );

        const parsed = requestSchema.safeParse( await request.json() );
        if ( !parsed.success )
            return NextResponse.json( { error: 'Your checkout details are invalid. Review your cart and delivery information.' }, { status: 400 } );

        const auth = await createClient();
        const { data: { user } } = await auth.auth.getUser();
        const userId = user?.id || null;
        const fingerprint = getFingerprint( userId, parsed.data.cartItems, parsed.data.shippingAddress );
        const db = getSupabaseAdmin();

        let { data: session, error: sessionError } = await db.from( 'cashfree_checkout_sessions' )
            .select( '*' )
            .eq( 'checkout_key', parsed.data.checkoutKey )
            .maybeSingle();
        if ( sessionError ) throw sessionError;

        if ( session && session.request_fingerprint !== fingerprint )
            return NextResponse.json( { error: 'This checkout request was already used with different details. Refresh checkout and try again.' }, { status: 409 } );

        if ( !session )
        {
            const pricedCart = await priceCheckoutCart( db, parsed.data.cartItems );
            const deliveryEstimate = await getDelhiveryDeliveryEstimate( parsed.data.shippingAddress.postalCode );
            if ( !deliveryEstimate.serviceable )
                return NextResponse.json( { error: 'Sorry, delivery is not available at this PIN code.' }, { status: 422 } );
            if ( !deliveryEstimate.prepaidAvailable )
                return NextResponse.json( { error: 'Prepaid delivery is not available at this PIN code.' }, { status: 422 } );
            if ( deliveryEstimate.prepaidCharge === null ) throw new DelhiveryServiceError();

            const shippingCost = await getCheckoutShippingCost( db, pricedCart.subtotal, deliveryEstimate.prepaidCharge );
            const amount = Math.round( ( pricedCart.subtotal + shippingCost ) * 100 ) / 100;
            if ( !Number.isFinite( amount ) || amount <= 0 )
                return NextResponse.json( { error: 'The order total is invalid. Please refresh your cart.' }, { status: 400 } );

            const latestOrderControl = await getOrderControlStatus();
            if ( latestOrderControl.orderPaused )
                return NextResponse.json(
                    { error: latestOrderControl.orderPauseMessage, code: 'ORDERS_PAUSED' },
                    { status: 409 }
                );

            const cashfreeOrderId = `sc_${ parsed.data.checkoutKey.replaceAll( '-', '' ) }`;
            const orderSnapshot = {
                user_email: user?.email || parsed.data.shippingAddress.email,
                email: user?.email || parsed.data.shippingAddress.email,
                shipping_address: parsed.data.shippingAddress,
                items: pricedCart.items,
                subtotal: pricedCart.subtotal,
                shipping_cost: shippingCost,
                tax: 0,
                coupon_code: null,
                coupon_discount: 0,
            };
            const { data: inserted, error: insertError } = await db.from( 'cashfree_checkout_sessions' )
                .insert( {
                    checkout_key: parsed.data.checkoutKey,
                    cashfree_order_id: cashfreeOrderId,
                    user_id: userId,
                    request_fingerprint: fingerprint,
                    order_snapshot: orderSnapshot,
                    inventory_snapshot: pricedCart.inventoryReservation,
                    amount,
                    currency: 'INR',
                } )
                .select( '*' )
                .single();

            if ( insertError?.code === '23505' )
            {
                const retry = await db.from( 'cashfree_checkout_sessions' )
                    .select( '*' )
                    .eq( 'checkout_key', parsed.data.checkoutKey )
                    .maybeSingle();
                if ( retry.error ) throw retry.error;
                if ( !retry.data || retry.data.request_fingerprint !== fingerprint )
                    return NextResponse.json( { error: 'This checkout request is already being processed. Try again shortly.' }, { status: 409 } );
                session = retry.data;
            } else
            {
                if ( insertError ) throw insertError;
                session = inserted;
            }
        }

        if ( session.status === 'paid' )
            return NextResponse.json( { alreadyPaid: true, orderNumber: session.order_id } );
        if ( session.status === 'expired' || session.status === 'refund_required' || session.status === 'refunded' )
            return NextResponse.json( { error: 'This payment session is no longer available. Refresh checkout to start again.' }, { status: 409 } );

        if ( session.payment_session_id )
            return NextResponse.json( {
                orderId: session.cashfree_order_id,
                paymentSessionId: session.payment_session_id,
                mode: getCashfreeCheckoutMode(),
            } );

        const checkoutMode = getCashfreeCheckoutMode();
        const siteUrl = getReturnUrl( request );
        siteUrl.searchParams.set( 'cashfree_order_id', session.cashfree_order_id );
        const notifyUrl = new URL( '/api/webhooks/cashfree', siteUrl.origin ).toString();
        const customer = parsed.data.shippingAddress;
        const client = getCashfreeClient();
        const providerResponse = await client.PGCreateOrder( {
            order_id: session.cashfree_order_id,
            order_amount: Number( session.amount ),
            order_currency: session.currency,
            customer_details: {
                customer_id: userId || `guest_${ parsed.data.checkoutKey.replaceAll( '-', '' ) }`,
                customer_name: customer.name,
                customer_email: customer.email,
                customer_phone: customer.phone,
            },
            order_meta: {
                return_url: `${ siteUrl.toString() }`,
                notify_url: notifyUrl,
            },
            order_expiry_time: new Date( Date.now() + 30 * 60 * 1000 ).toISOString(),
            order_note: 'SCOTLAND online order',
        }, randomUUID(), parsed.data.checkoutKey );

        const providerOrder = providerResponse.data;
        if ( providerOrder.order_id !== session.cashfree_order_id || !providerOrder.payment_session_id )
            throw new Error( 'Cashfree did not return a valid payment session.' );

        const { error: updateError } = await db.from( 'cashfree_checkout_sessions' )
            .update( {
                payment_session_id: providerOrder.payment_session_id,
                status: 'pending',
                updated_at: new Date().toISOString(),
            } )
            .eq( 'id', session.id );
        if ( updateError ) throw updateError;

        return NextResponse.json( {
            orderId: providerOrder.order_id,
            paymentSessionId: providerOrder.payment_session_id,
            mode: checkoutMode,
        } );
    } catch ( error )
    {
        console.error( 'Cashfree order initialization failed:', error );
        if ( error instanceof OrderControlUnavailableError )
            return NextResponse.json( { error: 'We cannot verify order availability right now. Please try again shortly.' }, { status: 503 } );
        if ( error instanceof DelhiveryServiceError )
            return NextResponse.json( { error: 'Delivery availability is temporarily unavailable. Please try again.' }, { status: 503 } );

        const message = error instanceof Error ? error.message : '';
        const unavailable = message.toLowerCase().includes( 'no longer available' ) ||
            message.toLowerCase().includes( 'no longer matches' );
        return NextResponse.json(
            { error: unavailable ? message : 'Could not initialize Cashfree payment. Please try again.' },
            { status: unavailable ? 409 : 500 }
        );
    }
}
