'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useStore } from '@/components/StoreProvider';

const money = ( n: number ) => new Intl.NumberFormat( 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 } ).format( n );

const DELIVERY_CHARGE = 50; // Flat ₹50 delivery for all orders

export default function Checkout ()
{
    const { cart, clearCart } = useStore();
    const router = useRouter();
    const [ done, setDone ] = useState( false );
    const [ paymentMethod, setPaymentMethod ] = useState<'cod' | 'razorpay'>( 'cod' );
    const [ loading, setLoading ] = useState( false );
    const [ mounted, setMounted ] = useState( false );
    const [ deliveryCharge, setDeliveryCharge ] = useState( 50 );

    const [ pincode, setPincode ] = useState( '' );
    const [ city, setCity ] = useState( '' );
    const [ isFetchingCity, setIsFetchingCity ] = useState( false );
    const [ pinError, setPinError ] = useState( '' );

    useEffect( () =>
    {
        setMounted( true );
        fetch( '/api/settings?t=' + Date.now() )
            .then( r => r.json() )
            .then( data => setDeliveryCharge( data.deliveryCharge ?? 50 ) )
            .catch( () => { } );
    }, [] );

    if ( !mounted ) return <main className="shell py-24 text-center"><p className="text-zinc-400">Loading checkout...</p></main>;

    const subtotal = cart.reduce( ( a, x ) => a + x.product.price * x.quantity, 0 );
    const total = subtotal + deliveryCharge;

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

    async function makePayment ()
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
                body: JSON.stringify( { amount: total } )
            } ).then( t => t.json() );

            if ( data.error )
            {
                alert( data.error );
                return;
            }

            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
                amount: data.amount,
                currency: data.currency,
                name: 'SCOTLAND E-Commerce',
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
                        setDone( true );
                        setTimeout( () => router.push( '/account/orders' ), 1200 );
                    } else
                    {
                        alert( 'Payment verification failed. Please contact support.' );
                    }
                },
                prefill: { name: '', email: '', contact: '' },
                theme: { color: '#0A192F' }
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

    const handlePincodeChange = async ( e: React.ChangeEvent<HTMLInputElement> ) =>
    {
        const val = e.target.value.replace( /\D/g, '' ).slice( 0, 6 ); // Only numbers
        setPincode( val );
        setPinError( '' );

        if ( val.length === 6 )
        {
            setIsFetchingCity( true );
            try
            {
                const res = await fetch( `https://api.postalpincode.in/pincode/${ val }` );
                const data = await res.json();

                if ( data && data[ 0 ] && data[ 0 ].Status === 'Success' && data[ 0 ].PostOffice )
                {
                    setCity( data[ 0 ].PostOffice[ 0 ].District || data[ 0 ].PostOffice[ 0 ].Division ); // Set auto City
                } else
                {
                    setCity( '' );
                    setPinError( 'Invalid PIN Code' );
                }
            } catch
            {
                setCity( '' );
                setPinError( 'Failed to verify PIN' );
            } finally
            {
                setIsFetchingCity( false );
            }
        }
    };

    async function submitOrderToBackend ( shippingAddress: any, razorpayData: any = null )
    {
        const payload = {
            cartItems: cart,
            shippingAddress,
            paymentMethod,
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
        return data;
    }

    async function makePayment ( shippingAddress: any )
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
                body: JSON.stringify( { amount: total } )
            } ).then( t => t.json() );

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

    async function submit ( e: FormEvent )
    {
        e.preventDefault();

        const fd = new FormData( e.target as HTMLFormElement );
        const shippingAddress = {
            name: `${ fd.get( 'firstName' ) } ${ fd.get( 'lastName' ) }`.trim(),
            email: fd.get( 'email' ),
            address: fd.get( 'address' ),
            city: city, // from state
            postalCode: pincode,
            phone: fd.get( 'phone' ),
            country: 'India'
        };

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
                        <input className="input mt-3" required type="email" name="email" placeholder="Email address" />
                    </section>

                    <section>
                        <h2 className="font-semibold">Delivery address</h2>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <input className="input" required name="firstName" placeholder="First name" pattern="[A-Za-z\s]+" title="Name should only contain letters" />
                            <input className="input" required name="lastName" placeholder="Last name" pattern="[A-Za-z\s]+" title="Name should only contain letters" />
                            <input className="input sm:col-span-2" required name="address" placeholder="Address" />

                            <div className="relative">
                                <input
                                    className={ `input w-full ${ pinError ? 'border-red-500' : '' }` }
                                    required
                                    placeholder="PIN code"
                                    value={ pincode }
                                    onChange={ handlePincodeChange }
                                    pattern="[0-9]{6}"
                                    title="PIN code must be 6 digits"
                                    maxLength={ 6 }
                                    minLength={ 6 }
                                />
                                { isFetchingCity && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-stone border-t-navy rounded-full animate-spin"></div> }
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

                            { pinError && (
                                <p className="text-xs text-red-500 sm:col-span-2 font-medium">{ pinError }</p>
                            ) }

                            <input className="input sm:col-span-2" required type="tel" name="phone" placeholder="Phone number (10 digits)" pattern="[0-9]{10}" maxLength={ 10 } minLength={ 10 } title="Phone number must be exactly 10 digits" />
                        </div>
                    </section>

                    <section>
                        <h2 className="font-semibold">Payment</h2>
                        <label className={ `mt-3 flex gap-3 border p-4 text-sm cursor-pointer ${ paymentMethod === 'cod' ? 'border-navy bg-white' : 'border-stone bg-white' }` }>
                            <input checked={ paymentMethod === 'cod' } onChange={ () => setPaymentMethod( 'cod' ) } type="radio" name="payment" />
                            <span className="font-medium">Cash on Delivery</span>
                        </label>
                        <label className={ `mt-2 flex gap-3 border p-4 text-sm cursor-pointer ${ paymentMethod === 'razorpay' ? 'border-navy bg-white' : 'border-stone bg-white' }` }>
                            <input checked={ paymentMethod === 'razorpay' } onChange={ () => setPaymentMethod( 'razorpay' ) } type="radio" name="payment" />
                            <span className="font-medium">Online Payment (Razorpay)</span>
                        </label>
                        <p className="mt-2 text-xs text-zinc-500">
                            { paymentMethod === 'razorpay' ? 'You will be redirected securely to Razorpay.' : 'Pay in cash when your order arrives.' }
                        </p>
                    </section>

                    <button disabled={ !cart.length || loading } className="button w-full disabled:opacity-40 transition flex justify-center items-center">
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
