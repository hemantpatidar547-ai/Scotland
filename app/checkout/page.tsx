'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useStore } from '@/components/StoreProvider';
import Script from 'next/script';

const money = ( n: number ) => new Intl.NumberFormat( 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 } ).format( n );

export default function Checkout ()
{
    const { cart } = useStore();
    const router = useRouter();
    const [ done, setDone ] = useState( false );
    const [ paymentMethod, setPaymentMethod ] = useState<'cod' | 'razorpay'>( 'cod' );
    const [ loading, setLoading ] = useState( false );

    const total = cart.reduce( ( a, x ) => a + x.product.price * x.quantity, 0 );

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
            // 1. Create order on the server
            const data = await fetch( '/api/razorpay/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { amount: total } )
            } ).then( ( t ) => t.json() );

            if ( data.error )
            {
                alert( data.error );
                return;
            }

            // 2. Initialize options
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_YourFallbackKeyHere',
                amount: data.amount,
                currency: data.currency,
                name: 'SCOTLAND E-Commerce',
                description: 'Payment for your order',
                order_id: data.id,
                handler: async function ( response: any )
                {
                    // 3. Verify payment on server
                    const verifyResult = await fetch( '/api/razorpay/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify( {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        } ),
                    } ).then( ( t ) => t.json() );

                    if ( verifyResult.success )
                    {
                        setDone( true );
                        setTimeout( () => router.push( '/account/orders' ), 1200 );
                    } else
                    {
                        alert( 'Payment verification failed. Please contact support.' );
                    }
                },
                prefill: {
                    name: 'Customer Name',
                    email: 'customer@example.com',
                    contact: '9999999999'
                },
                theme: { color: '#0A192F' }
            };

            const paymentObject = new ( window as any ).Razorpay( options );
            paymentObject.open();

        } catch ( error )
        {
            console.error( "Payment failed", error );
            alert( "Something went wrong during payment initialization." );
        } finally
        {
            setLoading( false );
        }
    }

    async function submit ( e: FormEvent )
    {
        e.preventDefault();
        if ( paymentMethod === 'razorpay' )
        {
            setLoading( true );
            await makePayment();
        } else
        {
            setDone( true );
            setTimeout( () => router.push( '/account/orders' ), 1200 );
        }
    }

    if ( done ) return (
        <main className="shell py-24 text-center">
            <h1 className="display text-5xl">Order received.</h1>
            <p className="mt-4">We’ll send your order confirmation shortly.</p>
        </main>
    );

    return (
        <main className="shell py-12">
            <h1 className="display text-5xl">Checkout</h1>
            <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
                <form onSubmit={ submit } className="space-y-7">
                    <section>
                        <h2 className="font-semibold">Contact information</h2>
                        <input className="input mt-3" required type="email" placeholder="Email address" />
                    </section>

                    <section>
                        <h2 className="font-semibold">Delivery address</h2>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <input className="input" required placeholder="First name" />
                            <input className="input" required placeholder="Last name" />
                            <input className="input sm:col-span-2" required placeholder="Address" />
                            <input className="input" required placeholder="City" />
                            <input className="input" required placeholder="PIN code" />
                            <input className="input" required placeholder="Phone number" />
                        </div>
                    </section>

                    <section>
                        <h2 className="font-semibold">Payment</h2>
                        <label className="mt-3 flex gap-3 border border-navy bg-white p-4 text-sm cursor-pointer">
                            <input
                                checked={ paymentMethod === 'cod' }
                                onChange={ () => setPaymentMethod( 'cod' ) }
                                type="radio"
                                name="payment"
                            />
                            Cash on Delivery
                        </label>
                        <label className="mt-2 flex gap-3 border border-stone bg-white p-4 text-sm cursor-pointer relative overflow-hidden">
                            <input
                                checked={ paymentMethod === 'razorpay' }
                                onChange={ () => setPaymentMethod( 'razorpay' ) }
                                type="radio"
                                name="payment"
                            />
                            <span className="flex items-center gap-2">Online payment (Razorpay)</span>
                        </label>
                        <p className="mt-2 text-xs text-zinc-500">
                            { paymentMethod === 'razorpay' ? 'You will be redirected securely to Razorpay to complete your purchase.' : 'Pay in cash upon delivery.' }
                        </p>
                    </section>

                    <button disabled={ !cart.length || loading } className="button w-full disabled:opacity-40 transition flex justify-center items-center">
                        { loading ? 'Processing payment...' : ( paymentMethod === 'razorpay' ? 'Pay Now securely' : 'Place order (COD)' ) }
                    </button>
                </form>

                <aside className="h-fit bg-white p-6">
                    <h2 className="display text-2xl">Your order</h2>
                    { cart.map( x => (
                        <div key={ x.product.id } className="mt-4 flex justify-between text-sm">
                            <span>{ x.product.name } × { x.quantity }</span>
                            <span>{ money( x.product.price * x.quantity ) }</span>
                        </div>
                    ) ) }
                    <div className="mt-6 flex justify-between border-t border-stone pt-4 font-semibold">
                        <span>Total</span>
                        <span>{ money( total ) }</span>
                    </div>
                </aside>
            </div>
        </main>
    );
}
