'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useStore } from '@/components/StoreProvider';
import { trackAnalyticsEvent } from '@/lib/analytics';

const money = ( n: number ) => new Intl.NumberFormat( 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 } ).format( n );

const DELIVERY_CHARGE = 50; // Flat ₹50 delivery for all orders

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
    const [ paymentMethod, setPaymentMethod ] = useState<'cod' | 'razorpay'>( 'cod' );
    const [ loading, setLoading ] = useState( false );
    const [ mounted, setMounted ] = useState( false );
    const [ returnPolicyAccepted, setReturnPolicyAccepted ] = useState( false );
    const [ deliveryCharge, setDeliveryCharge ] = useState( 50 );
    const [ freeDeliveryOffer, setFreeDeliveryOffer ] = useState( false );

    const [ pincode, setPincode ] = useState( '' );
    const [ city, setCity ] = useState( '' );
    const [ deliveryCheck, setDeliveryCheck ] = useState<DeliveryCheck | null>( null );
    const [ deliveryCheckStatus, setDeliveryCheckStatus ] = useState<'idle' | 'checking' | 'error'>( 'idle' );
    const [ deliveryCheckError, setDeliveryCheckError ] = useState( '' );

    // Pre-filled user data from session
    const [ userEmail, setUserEmail ] = useState( '' );
    const [ userFirstName, setUserFirstName ] = useState( '' );
    const [ userLastName, setUserLastName ] = useState( '' );
    const [ userPhone, setUserPhone ] = useState( '' );

    const subtotal = cart.reduce( ( a, x ) => a + ( x.product.salePrice || x.product.price ) * x.quantity, 0 );
    const total = subtotal + deliveryCharge;

    useEffect( () =>
    {
        setMounted( true );
        fetch( '/api/settings?t=' + Date.now() )
            .then( r => r.json() )
            .then( data =>
            {
                setFreeDeliveryOffer( data.freeDelivery === true );
                setDeliveryCharge( data.deliveryCharge ?? 50 );
            } )
            .catch( () => { } );

        // Auto-fill from authenticated session
        fetch( '/api/auth/session' )
            .then( r => r.json() )
            .then( data =>
            {
                if ( data.authenticated && data.user )
                {
                    const u = data.user;
                    if ( u.email ) setUserEmail( u.email );
                    if ( u.mobile ) setUserPhone( u.mobile );
                    if ( u.name )
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
                    setPaymentMethod( 'razorpay' );
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
        if ( deliveryCheck?.status !== 'available' ) return;
        const quote = paymentMethod === 'cod' ? deliveryCheck.cod : deliveryCheck.prepaid;
        if ( quote.courierCharge === null ) return;
        setDeliveryCharge( freeDeliveryOffer || subtotal >= 4000 ? 0 : quote.courierCharge );
    }, [ deliveryCheck, freeDeliveryOffer, paymentMethod, subtotal ] );

    if ( !mounted || !isReady ) return <main className="shell py-24 text-center"><p className="text-zinc-400">Loading checkout...</p></main>;

    const initializeRazorpay = () =>
    {
        return new Promise( ( resolve ) =>
        {
            const script = document.createElement( 'script' );
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve( true );
            script.onerror = () => resolve( false );
            document.body.appendChild( script );
        } );
    };

    const handlePincodeChange = ( e: React.ChangeEvent<HTMLInputElement> ) =>
    {
        const val = e.target.value.replace( /\D/g, '' ).slice( 0, 6 ); // Only numbers
        setPincode( val );
        setDeliveryCharge( freeDeliveryOffer || subtotal >= 4000 ? 0 : DELIVERY_CHARGE );
    };

    async function submitOrderToBackend ( shippingAddress: any, razorpayData: any = null )
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
            ...( razorpayData || {} )
        };

        const res = await fetch( '/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( payload )
        } );
        const data = await res.json();
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

    async function makePayment ( shippingAddress: {
        name: string;
        email: string;
        address: string;
        city: string;
        postalCode: string;
        phone: string;
        country: 'India';
    } )
    {
        const res = await initializeRazorpay();
        if ( !res )
        {
            alert( 'Razorpay SDK failed to load. Are you online?' );
            return;
        }

        try
        {
            const data = await fetch( '/api/razorpay/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( {
                    cartItems: cart.map( item => ( {
                        productId: item.product.id,
                        variantId: item.variantId,
                        size: item.size,
                        color: item.color,
                        quantity: item.quantity,
                    } ) ),
                    shippingAddress,
                } )
            } ).then( response => response.json() );

            if ( data.error )
            {
                alert( data.error );
                return;
            }

            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
                amount: data.amount,
                currency: data.currency,
                name: 'SCOTLAND',
                description: 'Payment for your order',
                order_id: data.id,
                handler: async function ( response: any )
                {
                    const verifyResult = await fetch( '/api/razorpay/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify( {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        } ),
                    } ).then( t => t.json() );

                    if ( verifyResult.success )
                    {
                        try
                        {
                            await submitOrderToBackend( shippingAddress, {
                                razorpayOrderId: response.razorpay_order_id,
                                razorpayPaymentId: response.razorpay_payment_id,
                                razorpaySignature: response.razorpay_signature,
                            } );
                            setDone( true );
                            clearCart();
                            setTimeout( () => router.push( '/account/orders' ), 1200 );
                        } catch ( e )
                        {
                            alert( 'Payment successful but order saving failed.' );
                            console.error( e );
                        }
                    } else
                    {
                        alert( 'Payment verification failed.' );
                    }
                },
                prefill: { name: shippingAddress.name, email: shippingAddress.email, contact: shippingAddress.phone },
                theme: { color: '#0A192F' } // Navy color
            };

            const paymentObject = new ( window as any ).Razorpay( options );
            paymentObject.open();

        } catch ( error )
        {
            console.error( 'Payment failed', error );
            alert( 'Something went wrong during payment initialization.' );
        } finally
        {
            setLoading( false );
        }
    }

    async function submit ( e: FormEvent<HTMLFormElement> )
    {
        e.preventDefault();
        const form = e.currentTarget;
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
            country: 'India' as const,
        };

        if ( shippingAddress.name.length < 2 ||
            !shippingAddress.email ||
            shippingAddress.address.length < 4 ||
            !shippingAddress.city ||
            !/^\d{6}$/.test( shippingAddress.postalCode ) ||
            !/^\d{10}$/.test( shippingAddress.phone ) )
        {
            alert( 'Please complete every delivery field with valid information before placing your order.' );
            return;
        }

        if ( paymentMethod === 'razorpay' )
        {
            setLoading( true );
            await makePayment( shippingAddress );
        } else
        {
            setLoading( true );
            try
            {
                await submitOrderToBackend( shippingAddress );
                setDone( true );
                clearCart();
                setTimeout( () => router.push( '/account/orders' ), 1200 );
            } catch ( err: any )
            {
                alert( 'Error saving order: ' + err.message );
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
                <form onSubmit={ submit } className="space-y-7">
                    <section>
                        <h2 className="font-semibold">Contact information</h2>
                        <input className="input mt-3" required type="email" name="email" placeholder="Email address" value={ userEmail } onChange={ e => setUserEmail( e.target.value ) } />
                    </section>

                    <section>
                        <h2 className="font-semibold">Delivery address</h2>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <input className="input" required name="firstName" placeholder="First name" pattern="[A-Za-z\s]+" title="Name should only contain letters" value={ userFirstName } onChange={ e => setUserFirstName( e.target.value ) } />
                            <input className="input" required name="lastName" placeholder="Last name" pattern="[A-Za-z\s]+" title="Name should only contain letters" value={ userLastName } onChange={ e => setUserLastName( e.target.value ) } />
                            <input className="input sm:col-span-2" required name="address" placeholder="Address" />

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
                        </div>
                    </section>

                    <section>
                        <h2 className="font-semibold">Payment</h2>
                        <label className={ `mt-3 flex gap-3 border p-4 text-sm cursor-pointer ${ paymentMethod === 'cod' ? 'border-navy bg-white' : 'border-stone bg-white' } ${ deliveryCheck?.status === 'available' && !deliveryCheck.cod.available ? 'cursor-not-allowed opacity-50' : '' }` }>
                            <input disabled={ deliveryCheck?.status === 'available' && !deliveryCheck.cod.available } checked={ paymentMethod === 'cod' } onChange={ () => setPaymentMethod( 'cod' ) } type="radio" name="payment" />
                            <span className="font-medium">Cash on Delivery</span>
                        </label>
                        <label className={ `mt-2 flex gap-3 border p-4 text-sm cursor-pointer ${ paymentMethod === 'razorpay' ? 'border-navy bg-white' : 'border-stone bg-white' } ${ deliveryCheck?.status === 'available' && !deliveryCheck.prepaid.available ? 'cursor-not-allowed opacity-50' : '' }` }>
                            <input disabled={ deliveryCheck?.status === 'available' && !deliveryCheck.prepaid.available } checked={ paymentMethod === 'razorpay' } onChange={ () => setPaymentMethod( 'razorpay' ) } type="radio" name="payment" />
                            <span className="font-medium">Online Payment (Razorpay)</span>
                        </label>
                        <p className="mt-2 text-xs text-zinc-500">
                            { paymentMethod === 'razorpay' ? 'You will be redirected securely to Razorpay.' : 'Pay in cash when your order arrives.' }
                        </p>
                    </section>

                    <section className="border border-stone bg-white p-4">
                        <h2 className="font-semibold">Delivery, cancellation &amp; return policy</h2>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-zinc-600">
                            <li>You may cancel before the order is dispatched.</li>
                            <li>Request a return within 48 hours of delivery. The return window starts when the order is marked delivered.</li>
                            <li>The return courier charge is checked using the courier rate API and deducted from your refund. The original delivery charge is not refundable; the return charge and estimated refund are shown before you submit a return.</li>
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
                        !returnPolicyAccepted ||
                        deliveryCheckStatus !== 'idle' ||
                        deliveryCheck?.status !== 'available' ||
                        !( paymentMethod === 'cod' ? deliveryCheck.cod.available : deliveryCheck.prepaid.available )
                    } className="button w-full disabled:opacity-40 transition flex justify-center items-center">
                        { loading ? 'Processing...' : ( paymentMethod === 'razorpay' ? 'Pay Now securely' : 'Place order (COD)' ) }
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
                            { deliveryCharge === 0 ? (
                                <span className="text-emerald-600 font-semibold">FREE 🎉</span>
                            ) : (
                                <span className="text-zinc-500">{ money( deliveryCharge ) }</span>
                            ) }
                        </div>
                        <div className="flex justify-between font-semibold text-lg border-t border-stone pt-3 mt-2">
                            <span>Total</span>
                            <span>{ money( total ) }</span>
                        </div>
                    </div>
                </aside>
            </div>
        </main>
    );
}
