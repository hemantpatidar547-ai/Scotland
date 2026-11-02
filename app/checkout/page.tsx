'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { load as loadCashfree } from '@cashfreepayments/cashfree-js';
import { useStore } from '@/components/StoreProvider';
import { trackAnalyticsEvent } from '@/lib/analytics';

const money = ( n: number ) => new Intl.NumberFormat( 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 } ).format( n );
const CASHFREE_CHECKOUT_DETAILS_KEY = 'scotland-cashfree-checkout-details';

function clearSavedCashfreeCheckoutDetails ()
{
    try
    {
        localStorage.removeItem( CASHFREE_CHECKOUT_DETAILS_KEY );
    } catch ( error )
    {
        console.warn( 'Could not clear temporarily saved Cashfree checkout details.', error );
    }
}

type DeliveryMethodQuote = {
    available: boolean;
    courierCharge: number | null;
};

type DeliveryCheck = {
    status: 'available' | 'unavailable';
    message: string;
    estimatedDeliveryDays: number | null;
    district: string | null;
    cod: DeliveryMethodQuote;
    prepaid: DeliveryMethodQuote;
};

export default function Checkout ()
{
    const { cart, clearCart, isReady } = useStore();
    const router = useRouter();
    const [ done, setDone ] = useState( false );
    const [ paymentMethod, setPaymentMethod ] = useState<'cod' | 'cashfree'>( 'cod' );
    const [ loading, setLoading ] = useState( false );
    const [ mounted, setMounted ] = useState( false );
    const [ returnPolicyAccepted, setReturnPolicyAccepted ] = useState( false );
    const [ deliveryCharge, setDeliveryCharge ] = useState<number | null>( null );
    const [ freeDeliveryOffer, setFreeDeliveryOffer ] = useState( false );

    const [ pincode, setPincode ] = useState( '' );
    const [ city, setCity ] = useState( '' );
    const [ deliveryCheck, setDeliveryCheck ] = useState<DeliveryCheck | null>( null );
    const [ deliveryCheckStatus, setDeliveryCheckStatus ] = useState<'idle' | 'checking' | 'error'>( 'idle' );
    const [ deliveryCheckError, setDeliveryCheckError ] = useState( '' );
    const [ orderControlReady, setOrderControlReady ] = useState( false );
    const [ orderPaused, setOrderPaused ] = useState( false );
    const [ orderPauseMessage, setOrderPauseMessage ] = useState( '' );
    const [ orderControlError, setOrderControlError ] = useState( '' );
    const [ checkingOrderControl, setCheckingOrderControl ] = useState( false );
    const [ pauseModalMessage, setPauseModalMessage ] = useState( '' );
    const [ paymentNotice, setPaymentNotice ] = useState( '' );
    const [ paymentPending, setPaymentPending ] = useState( false );

    // Pre-filled user data from session
    const [ userEmail, setUserEmail ] = useState( '' );
    const [ userFirstName, setUserFirstName ] = useState( '' );
    const [ userLastName, setUserLastName ] = useState( '' );
    const [ userPhone, setUserPhone ] = useState( '' );
    const [ alternatePhone, setAlternatePhone ] = useState( '' );
    const [ streetAddress, setStreetAddress ] = useState( '' );

    const subtotal = cart.reduce( ( a, x ) => a + ( x.product.salePrice || x.product.price ) * x.quantity, 0 );
    const freeDelivery = freeDeliveryOffer || subtotal >= 4000;
    const total = subtotal + ( deliveryCharge ?? 0 );

    useEffect( () =>
    {
        setMounted( true );
        let restoredCheckoutDetails = false;
        try
        {
            const savedDetails = localStorage.getItem( CASHFREE_CHECKOUT_DETAILS_KEY );
            if ( savedDetails )
            {
                const details = JSON.parse( savedDetails ) as Record<string, unknown>;
                const savedAt = typeof details.savedAt === 'number' ? details.savedAt : 0;
                if ( Date.now() - savedAt < 24 * 60 * 60 * 1000 )
                {
                    restoredCheckoutDetails = true;
                    if ( typeof details.email === 'string' ) setUserEmail( details.email );
                    if ( typeof details.firstName === 'string' ) setUserFirstName( details.firstName );
                    if ( typeof details.lastName === 'string' ) setUserLastName( details.lastName );
                    if ( typeof details.phone === 'string' ) setUserPhone( details.phone );
                    if ( typeof details.alternatePhone === 'string' ) setAlternatePhone( details.alternatePhone );
                    if ( typeof details.address === 'string' ) setStreetAddress( details.address );
                    if ( typeof details.postalCode === 'string' ) setPincode( details.postalCode );
                    if ( typeof details.city === 'string' ) setCity( details.city );
                }
                else
                    localStorage.removeItem( CASHFREE_CHECKOUT_DETAILS_KEY );
            }
        } catch ( error )
        {
            console.warn( 'Could not restore Cashfree checkout details.', error );
        }
        // Auto-fill from authenticated session
        fetch( '/api/auth/session' )
            .then( r => r.json() )
            .then( data =>
            {
                if ( data.authenticated && data.user )
                {
                    const u = data.user;
                    if ( !restoredCheckoutDetails && u.email ) setUserEmail( u.email );
                    if ( !restoredCheckoutDetails && u.mobile ) setUserPhone( u.mobile );
                    if ( !restoredCheckoutDetails && u.name )
                    {
                        const parts = u.name.trim().split( /\s+/ );
                        setUserFirstName( parts[ 0 ] || '' );
                        setUserLastName( parts.slice( 1 ).join( ' ' ) || '' );
                    }
                }
            } )
            .catch( () => { } );
    }, [] );

    useEffect( () =>
    {
        setDeliveryCheck( null );
        setDeliveryCheckError( '' );
        if ( pincode.length !== 6 )
        {
            setDeliveryCheckStatus( 'idle' );
            return;
        }

        const controller = new AbortController();
        const timeout = window.setTimeout( async () =>
        {
            setDeliveryCheckStatus( 'checking' );
            try
            {
                const response = await fetch( '/api/delivery/serviceability', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify( { pincode } ),
                    signal: controller.signal,
                } );
                const result = await response.json();
                if ( !response.ok ) throw new Error( result.error || 'Delivery availability is temporarily unavailable.' );

                const availability = result as DeliveryCheck;
                setDeliveryCheck( availability );
                setDeliveryCheckStatus( 'idle' );
                if ( availability.district ) setCity( availability.district );
                if ( availability.status === 'available' &&
                    !availability.cod.available &&
                    availability.prepaid.available )
                {
                    setPaymentMethod( 'cashfree' );
                }
            } catch ( error )
            {
                if ( controller.signal.aborted ) return;
                setDeliveryCheckStatus( 'error' );
                setDeliveryCheckError( error instanceof Error
                    ? error.message
                    : 'Delivery availability is temporarily unavailable. Please try again.' );
            }
        }, 350 );

        return () =>
        {
            window.clearTimeout( timeout );
            controller.abort();
        };
    }, [ pincode ] );

    useEffect( () =>
    {
        let active = true;
        let refreshTimer: number | undefined;
        const refreshOrderControl = async () =>
        {
            try
            {
                const response = await fetch( '/api/settings', { cache: 'no-store' } );
                const result = await response.json();
                if ( !response.ok ) throw new Error( result.error || 'Could not verify order availability.' );
                if ( !active ) return;
                setFreeDeliveryOffer( result.freeDelivery === true );
                setOrderPaused( result.orderPaused === true );
                setOrderPauseMessage( typeof result.orderPauseMessage === 'string' ? result.orderPauseMessage : '' );
                setOrderControlError( '' );
                setOrderControlReady( true );
            } catch ( error )
            {
                if ( !active ) return;
                setOrderControlReady( false );
                setOrderControlError( error instanceof Error ? error.message : 'Could not verify order availability.' );
            } finally
            {
                if ( active ) refreshTimer = window.setTimeout( () => void refreshOrderControl(), 10000 );
            }
        };

        void refreshOrderControl();
        return () =>
        {
            active = false;
            if ( refreshTimer !== undefined ) window.clearTimeout( refreshTimer );
        };
    }, [] );

    useEffect( () =>
    {
        if ( freeDelivery )
        {
            setDeliveryCharge( 0 );
            return;
        }
        if ( deliveryCheck?.status !== 'available' )
        {
            setDeliveryCharge( null );
            return;
        }
        const quote = paymentMethod === 'cod' ? deliveryCheck.cod : deliveryCheck.prepaid;
        setDeliveryCharge( quote.courierCharge );
    }, [ deliveryCheck, freeDelivery, paymentMethod ] );

    const handlePincodeChange = ( e: React.ChangeEvent<HTMLInputElement> ) =>
    {
        const val = e.target.value.replace( /\D/g, '' ).slice( 0, 6 ); // Only numbers
        setPincode( val );
        setDeliveryCharge( freeDelivery ? 0 : null );
    };

    async function submitOrderToBackend ( shippingAddress: any )
    {
        const payload = {
            cartItems: cart.map( item => ( {
                productId: item.product.id,
                variantId: item.variantId,
                size: item.size,
                color: item.color,
                quantity: item.quantity,
            } ) ),
            shippingAddress,
            paymentMethod,
            returnPolicyAccepted,
            couponDiscount: 0,
        };

        const res = await fetch( '/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( payload )
        } );
        const data = await res.json();
        if ( data.code === 'ORDERS_PAUSED' )
        {
            setPauseModalMessage( data.error );
            throw new Error( 'ORDERS_PAUSED' );
        }
        if ( data.error ) throw new Error( data.error );
        trackAnalyticsEvent( 'purchase', {
            transaction_id: data.orderNumber,
            currency: 'INR',
            value: data.finalAmount,
            items: cart.map( item => ( {
                item_id: item.product.sku || item.product.id,
                item_name: item.product.name,
                item_variant: `${ item.color } / ${ item.size }`,
                price: item.product.salePrice || item.product.price,
                quantity: item.quantity,
            } ) ),
        } );
        return data;
    }

    async function makeCashfreePayment ( shippingAddress: {
        name: string;
        email: string;
        address: string;
        city: string;
        postalCode: string;
        phone: string;
        alternatePhone?: string;
        country: 'India';
    } )
    {
        try
        {
            const response = await fetch( '/api/cashfree/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( {
                    checkoutKey: crypto.randomUUID(),
                    cartItems: cart.map( item => ( {
                        productId: item.product.id,
                        variantId: item.variantId,
                        size: item.size,
                        color: item.color,
                        quantity: item.quantity,
                    } ) ),
                    shippingAddress,
                    returnPolicyAccepted,
                } )
            } );
            const data = await response.json();

            if ( !response.ok )
            {
                if ( data.code === 'ORDERS_PAUSED' ) setPauseModalMessage( data.error );
                else setPaymentNotice( data.error || 'Could not initialize Cashfree payment.' );
                return;
            }

            if ( data.alreadyPaid )
            {
                setPaymentNotice( 'This payment is already confirmed. Opening your order history.' );
                clearCart();
                setTimeout( () => router.push( '/account/orders' ), 1000 );
                return;
            }

            if ( typeof data.paymentSessionId !== 'string' ||
                ( data.mode !== 'sandbox' && data.mode !== 'production' ) )
                throw new Error( 'Cashfree returned an invalid checkout session. Please try again.' );

            const cashfree = await loadCashfree( { mode: data.mode } );
            if ( !cashfree )
            {
                setPaymentNotice( 'Cashfree Checkout could not be loaded. Please check your connection and try again.' );
                return;
            }

            const checkoutResult = await cashfree.checkout( {
                paymentSessionId: data.paymentSessionId,
                redirectTarget: '_self',
            } );
            if ( checkoutResult?.error )
                setPaymentNotice( checkoutResult.error.message || 'Cashfree could not start the payment. Please try again.' );
        } catch ( error )
        {
            console.error( 'Cashfree checkout initialization failed:', error );
            setPaymentNotice( error instanceof Error
                ? `${ error.message } Your cart is unchanged; please try again.`
                : 'Cashfree payment could not be started. Your cart is unchanged; please try again.' );
        } finally
        {
            setLoading( false );
        }
    }

    useEffect( () =>
    {
        if ( !mounted ) return;
        const orderId = new URLSearchParams( window.location.search ).get( 'cashfree_order_id' );
        if ( !orderId ) return;

        let active = true;
        let attempts = 0;
        let pollTimer: number | undefined;
        const complete = ( status: string ) =>
        {
            if ( status === 'paid' )
            {
                setPaymentPending( false );
                setDone( true );
                clearCart();
                clearSavedCashfreeCheckoutDetails();
                window.history.replaceState( null, '', '/checkout' );
                setTimeout( () => router.push( '/account/orders' ), 1200 );
                return true;
            }
            if ( status === 'refund_required' )
            {
                setPaymentPending( false );
                setPaymentNotice( 'Payment was received, but the order could not be confirmed. A refund has been initiated; your cart remains available.' );
                window.history.replaceState( null, '', '/checkout' );
                return true;
            }
            if ( status === 'failed' )
            {
                setPaymentPending( false );
                setPaymentNotice( 'The payment did not complete. Your cart and checkout details are still available; you can try again.' );
                window.history.replaceState( null, '', '/checkout' );
                return true;
            }
            return false;
        };
        const scheduleRetry = () =>
        {
            if ( !active ) return;
            setPaymentPending( true );
            if ( attempts >= 120 )
            {
                setPaymentNotice( 'Payment is still processing. Checkout is paused to prevent a duplicate payment; refresh this page to check again or contact support.' );
                return;
            }
            setPaymentNotice( 'Payment is still processing. We are checking Cashfree status; your cart remains unchanged.' );
            pollTimer = window.setTimeout( () => void verifyPayment(), 5000 );
        };
        const verifyPayment = async () =>
        {
            attempts += 1;
            try
            {
                const response = await fetch( '/api/cashfree/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify( { orderId } ),
                } );
                const result = await response.json();
                if ( !response.ok ) throw new Error( result.error || 'We could not confirm the payment status yet.' );
                if ( !active ) return;
                if ( !complete( result.status ) ) scheduleRetry();
            } catch ( error )
            {
                if ( !active ) return;
                setPaymentNotice( error instanceof Error ? error.message : 'We could not confirm the payment status yet.' );
                scheduleRetry();
            } finally
            {
                if ( active ) setLoading( false );
            }
        };

        setLoading( true );
        setPaymentPending( true );
        void verifyPayment();

        return () =>
        {
            active = false;
            if ( pollTimer !== undefined ) window.clearTimeout( pollTimer );
        };
    }, [ mounted, clearCart, router ] );

    if ( !mounted || !isReady ) return <main className="shell py-24 text-center"><p className="text-zinc-400">Loading checkout...</p></main>;

    async function submit ( e: FormEvent<HTMLFormElement> )
    {
        e.preventDefault();
        const form = e.currentTarget;
        setCheckingOrderControl( true );
        try
        {
            const response = await fetch( '/api/settings', { cache: 'no-store' } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not verify order availability.' );

            setFreeDeliveryOffer( result.freeDelivery === true );
            setOrderPaused( result.orderPaused === true );
            setOrderPauseMessage( typeof result.orderPauseMessage === 'string' ? result.orderPauseMessage : '' );
            setOrderControlError( '' );
            setOrderControlReady( true );
            if ( result.orderPaused === true )
            {
                setPauseModalMessage( result.orderPauseMessage );
                return;
            }
        } catch ( error )
        {
            const message = error instanceof Error ? error.message : 'Could not verify order availability.';
            setOrderControlReady( false );
            setOrderControlError( message );
            setPauseModalMessage( 'We cannot verify order availability right now. Please try again shortly.' );
            return;
        } finally
        {
            setCheckingOrderControl( false );
        }

        if ( !form.reportValidity() ) return;

        const selectedDelivery = paymentMethod === 'cod' ? deliveryCheck?.cod : deliveryCheck?.prepaid;
        if ( deliveryCheckStatus === 'error' || deliveryCheck?.status !== 'available' ||
            deliveryCheck.cod.available === false && deliveryCheck.prepaid.available === false )
        {
            alert( deliveryCheckError || deliveryCheck?.message || 'Please wait for delivery availability to be confirmed.' );
            return;
        }
        if ( !selectedDelivery?.available || selectedDelivery.courierCharge === null )
        {
            alert( 'This payment method is not available for the entered PIN code.' );
            return;
        }

        trackAnalyticsEvent( 'begin_checkout', {
            currency: 'INR',
            value: total,
            items: cart.map( item => ( {
                item_id: item.product.sku || item.product.id,
                item_name: item.product.name,
                item_variant: `${ item.color } / ${ item.size }`,
                price: item.product.salePrice || item.product.price,
                quantity: item.quantity,
            } ) ),
        } );

        if ( !returnPolicyAccepted )
        {
            alert( 'Please read and accept the delivery, cancellation, and return policy before placing your order.' );
            return;
        }

        const fd = new FormData( form );
        const shippingAddress = {
            name: `${ fd.get( 'firstName' ) } ${ fd.get( 'lastName' ) }`.trim(),
            email: String( fd.get( 'email' ) || '' ).trim(),
            address: String( fd.get( 'address' ) || '' ).trim(),
            city: city.trim(),
            postalCode: pincode,
            phone: String( fd.get( 'phone' ) || '' ).replace( /\D/g, '' ),
            alternatePhone: String( fd.get( 'alternatePhone' ) || '' ).replace( /\D/g, '' ),
            country: 'India' as const,
        };

        if ( shippingAddress.name.length < 2 ||
            !shippingAddress.email ||
            shippingAddress.address.length < 4 ||
            !shippingAddress.city ||
            !/^\d{6}$/.test( shippingAddress.postalCode ) ||
            !/^\d{10}$/.test( shippingAddress.phone ) ||
            Boolean( shippingAddress.alternatePhone ) && !/^\d{10}$/.test( shippingAddress.alternatePhone ) )
        {
            alert( 'Please complete the delivery fields with valid phone numbers before placing your order.' );
            return;
        }

        if ( paymentMethod === 'cashfree' )
        {
            try
            {
                localStorage.setItem( CASHFREE_CHECKOUT_DETAILS_KEY, JSON.stringify( {
                    email: userEmail,
                    firstName: userFirstName,
                    lastName: userLastName,
                    phone: userPhone,
                    alternatePhone,
                    address: streetAddress,
                    postalCode: pincode,
                    city,
                    savedAt: Date.now(),
                } ) );
            } catch ( error )
            {
                console.warn( 'Could not temporarily save checkout details before Cashfree redirect.', error );
            }
            setLoading( true );
            await makeCashfreePayment( shippingAddress );
        } else
        {
            setLoading( true );
            try
            {
                await submitOrderToBackend( shippingAddress );
                setDone( true );
                clearCart();
                clearSavedCashfreeCheckoutDetails();
                setTimeout( () => router.push( '/account/orders' ), 1200 );
            } catch ( err: any )
            {
                if ( err.message !== 'ORDERS_PAUSED' ) alert( 'Error saving order: ' + err.message );
                setLoading( false );
            }
        }
    }

    if ( done ) return (
        <main className="shell py-24 text-center">
            <h1 className="display text-5xl">Order received.</h1>
            <p className="mt-4">We'll send your order confirmation shortly.</p>
        </main>
    );

    return (
        <main className="shell py-12">
            <h1 className="display text-5xl">Checkout</h1>
            <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
                { orderPaused && <div className="mb-6 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="status">
                    <p className="font-semibold">Orders are temporarily paused</p>
                    <p className="mt-1">{ orderPauseMessage }</p>
                </div> }
                { orderControlError && <p className="mb-6 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
                    Order availability could not be verified. New orders are disabled until the store status can be confirmed.
                </p> }
                { !orderControlReady && !orderControlError && <p className="mb-6 text-sm text-zinc-500" role="status">Checking whether orders are open…</p> }
                { paymentNotice && <p className="mb-6 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="status">{ paymentNotice }</p> }

                <form noValidate onSubmit={ submit } className="space-y-7">
                    <section>
                        <h2 className="font-semibold">Contact information</h2>
                        <input className="input mt-3" required type="email" name="email" placeholder="Email address" value={ userEmail } onChange={ e => setUserEmail( e.target.value ) } />
                    </section>

                    <section>
                        <h2 className="font-semibold">Delivery address</h2>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <input className="input" required name="firstName" placeholder="First name" pattern="[A-Za-z\s]+" title="Name should only contain letters" value={ userFirstName } onChange={ e => setUserFirstName( e.target.value ) } />
                            <input className="input" required name="lastName" placeholder="Last name" pattern="[A-Za-z\s]+" title="Name should only contain letters" value={ userLastName } onChange={ e => setUserLastName( e.target.value ) } />
                            <input className="input sm:col-span-2" required name="address" placeholder="Address" value={ streetAddress } onChange={ event => setStreetAddress( event.target.value ) } />

                            <div className="relative">
                                <input
                                    className={ `input w-full ${ deliveryCheck?.status === 'unavailable' || deliveryCheckStatus === 'error' ? 'border-red-500' : '' }` }
                                    required
                                    placeholder="PIN code"
                                    value={ pincode }
                                    onChange={ handlePincodeChange }
                                    pattern="[0-9]{6}"
                                    title="PIN code must be 6 digits"
                                    maxLength={ 6 }
                                    minLength={ 6 }
                                />
                                { deliveryCheckStatus === 'checking' && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-stone border-t-navy rounded-full animate-spin"></div> }
                            </div>

                            <input
                                className="input"
                                required
                                name="city"
                                placeholder="City/District"
                                value={ city }
                                onChange={ ( e ) => setCity( e.target.value ) }
                                pattern="[A-Za-z\s]+"
                                title="City should only contain letters"
                            />

                            { deliveryCheckStatus === 'checking' && (
                                <p className="text-xs text-zinc-500 sm:col-span-2" role="status">Checking courier serviceability…</p>
                            ) }
                            { deliveryCheck?.status === 'available' && (
                                <div className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 sm:col-span-2" role="status">
                                    <p className="font-semibold">Delivery Available</p>
                                    <p className="mt-1 text-xs">Estimated delivery: { deliveryCheck.estimatedDeliveryDays } days after courier handover.</p>
                                    <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                                        <p>Prepaid: { deliveryCheck.prepaid.available
                                            ? `Available · ${ money( freeDeliveryOffer || subtotal >= 4000 ? 0 : deliveryCheck.prepaid.courierCharge || 0 ) } delivery charge${ freeDeliveryOffer || subtotal >= 4000 ? ' (free delivery offer)' : '' }`
                                            : 'Not available' }</p>
                                        <p>Cash on Delivery: { deliveryCheck.cod.available
                                            ? `Available · ${ money( freeDeliveryOffer || subtotal >= 4000 ? 0 : deliveryCheck.cod.courierCharge || 0 ) } delivery charge${ freeDeliveryOffer || subtotal >= 4000 ? ' (free delivery offer)' : '' }`
                                            : 'Not available' }</p>
                                    </div>
                                </div>
                            ) }
                            { deliveryCheck?.status === 'unavailable' && (
                                <p className="text-xs font-medium text-red-600 sm:col-span-2" role="alert">
                                    Sorry, delivery is not available at this PIN code.
                                </p>
                            ) }
                            { deliveryCheckStatus === 'error' && (
                                <p className="text-xs font-medium text-amber-700 sm:col-span-2" role="alert">
                                    { deliveryCheckError } This does not mean the PIN code is unavailable.
                                </p>
                            ) }

                            <input className="input sm:col-span-2" required type="tel" name="phone" placeholder="Phone number (10 digits)" pattern="[0-9]{10}" maxLength={ 10 } minLength={ 10 } title="Phone number must be exactly 10 digits" value={ userPhone } onChange={ e => setUserPhone( e.target.value.replace( /\D/g, '' ).slice( 0, 10 ) ) } />
                            <input className="input sm:col-span-2" type="tel" name="alternatePhone" placeholder="Alternate phone number (optional, 10 digits)" pattern="[0-9]{10}" maxLength={ 10 } minLength={ 10 } title="Alternate phone number must be exactly 10 digits" value={ alternatePhone } onChange={ e => setAlternatePhone( e.target.value.replace( /\D/g, '' ).slice( 0, 10 ) ) } />
                        </div>
                    </section>

                    <section>
                        <h2 className="font-semibold">Payment</h2>
                        <label className={ `mt-3 flex gap-3 border p-4 text-sm cursor-pointer ${ paymentMethod === 'cod' ? 'border-navy bg-white' : 'border-stone bg-white' } ${ deliveryCheck?.status === 'available' && !deliveryCheck.cod.available ? 'cursor-not-allowed opacity-50' : '' }` }>
                            <input disabled={ deliveryCheck?.status === 'available' && !deliveryCheck.cod.available } checked={ paymentMethod === 'cod' } onChange={ () => setPaymentMethod( 'cod' ) } type="radio" name="payment" />
                            <span className="font-medium">Cash on Delivery</span>
                        </label>
                        <label className={ `mt-2 flex gap-3 border p-4 text-sm cursor-pointer ${ paymentMethod === 'cashfree' ? 'border-navy bg-white' : 'border-stone bg-white' } ${ deliveryCheck?.status === 'available' && !deliveryCheck.prepaid.available ? 'cursor-not-allowed opacity-50' : '' }` }>
                            <input disabled={ deliveryCheck?.status === 'available' && !deliveryCheck.prepaid.available } checked={ paymentMethod === 'cashfree' } onChange={ () => setPaymentMethod( 'cashfree' ) } type="radio" name="payment" />
                            <span className="font-medium">Online Payment (Cashfree)</span>
                        </label>
                        <p className="mt-2 text-xs text-zinc-500">
                            { paymentMethod === 'cashfree' ? 'You will be redirected securely to Cashfree Checkout.' : 'Pay in cash when your order arrives.' }
                        </p>
                    </section>

                    <section className="border border-stone bg-white p-4">
                        <h2 className="font-semibold">Delivery, cancellation &amp; return policy</h2>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-zinc-600">
                            <li>You may cancel before the order is dispatched.</li>
                            <li>Request a return within 48 hours of delivery. The return window starts when the order is marked delivered.</li>
                            <li>A fixed ₹35 return courier charge is deducted from your eligible refund. For example, ₹435 eligible return value means ₹400 refund after this charge. The original delivery charge is not refundable; your estimated refund is shown before you submit a return.</li>
                            <li>Refund is processed after the returned product is received and checked. Online refunds are handled manually by the store; COD refunds are arranged by customer support.</li>
                        </ul>
                        <label className="mt-4 flex items-start gap-2 text-sm">
                            <input
                                className="mt-1"
                                type="checkbox"
                                required
                                checked={ returnPolicyAccepted }
                                onChange={ event => setReturnPolicyAccepted( event.target.checked ) }
                            />
                            <span>I have read and agree to this delivery, cancellation, and return policy.</span>
                        </label>
                    </section>

                    <button disabled={
                        !cart.length ||
                        loading ||
                        paymentPending ||
                        checkingOrderControl ||
                        ( !orderPaused && (
                            !orderControlReady ||
                            !returnPolicyAccepted ||
                            deliveryCheckStatus !== 'idle' ||
                            deliveryCheck?.status !== 'available' ||
                            !( paymentMethod === 'cod' ? deliveryCheck.cod.available : deliveryCheck.prepaid.available )
                        ) )
                    } className="button w-full disabled:opacity-40 transition flex justify-center items-center">
                        { checkingOrderControl ? 'Checking order status…' : loading ? 'Processing...' : paymentPending ? 'Payment confirmation pending…' : orderPaused ? 'View order pause message' : ( paymentMethod === 'cashfree' ? 'Pay Now securely' : 'Place order (COD)' ) }
                    </button>
                </form>

                {/* Order Summary */ }
                <aside className="h-fit bg-white p-6 border border-stone">
                    <h2 className="display text-2xl">Your order</h2>
                    { cart.map( x => (
                        <div key={ x.product.id } className="mt-4 flex justify-between text-sm">
                            <span>{ x.product.name } × { x.quantity }</span>
                            <span>{ money( x.product.price * x.quantity ) }</span>
                        </div>
                    ) ) }

                    <div className="mt-5 border-t border-stone pt-4 space-y-2">
                        <div className="flex justify-between text-sm text-zinc-500">
                            <span>Subtotal</span>
                            <span>{ money( subtotal ) }</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Delivery</span>
                            { freeDelivery ? (
                                <span className="text-emerald-600 font-semibold">FREE 🎉</span>
                            ) : deliveryCharge !== null ? (
                                <span className="text-zinc-500">{ money( deliveryCharge ) }</span>
                            ) : (
                                <span className="text-zinc-500">
                                    { deliveryCheck?.status === 'unavailable'
                                        ? 'Not available for this PIN'
                                        : deliveryCheck?.status === 'available'
                                            ? 'Not available for this payment method'
                                        : deliveryCheckStatus === 'checking'
                                            ? 'Checking…'
                                            : deliveryCheckStatus === 'error'
                                                ? 'Could not calculate'
                                                : 'Enter PIN to calculate' }
                                </span>
                            ) }
                        </div>
                        <div className="flex justify-between font-semibold text-lg border-t border-stone pt-3 mt-2">
                            <span>Total</span>
                            <span>{ money( total ) }</span>
                        </div>
                    </div>
                </aside>
            </div>
            { pauseModalMessage && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={ event =>
                {
                    if ( event.target === event.currentTarget ) setPauseModalMessage( '' );
                } }>
                <section className="w-full max-w-md border border-stone bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="order-pause-title">
                    <p className="eyebrow text-zinc-500">Store notice</p>
                    <h2 id="order-pause-title" className="display mt-2 text-2xl text-navy">Orders temporarily paused</h2>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{ pauseModalMessage }</p>
                    <p className="mt-3 text-xs text-zinc-500">Your bag and checkout details are still here. Please try placing your order again later.</p>
                    <button type="button" className="button mt-6 w-full" onClick={ () => setPauseModalMessage( '' ) }>Got it</button>
                </section>
            </div> }
        </main>
    );
}
