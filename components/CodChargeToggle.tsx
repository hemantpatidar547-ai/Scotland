'use client';
import { useEffect, useState } from 'react';

export function DeliveryChargeToggle ()
{
    const [ freeDelivery, setFreeDelivery ] = useState( false );
    const [ loading, setLoading ] = useState( true );
    const [ saving, setSaving ] = useState( false );

    useEffect( () =>
    {
        fetch( '/api/settings?t=' + Date.now() )
            .then( r => r.json() )
            .then( data => { setFreeDelivery( data.freeDelivery ?? false ); setLoading( false ); } )
            .catch( () => setLoading( false ) );
    }, [] );

    const toggle = async () =>
    {
        setSaving( true );
        const newValue = !freeDelivery;
        try
        {
            const res = await fetch( '/api/admin/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { freeDelivery: newValue } )
            } );

            if ( !res.ok )
            {
                const text = await res.text();
                throw new Error( text || 'failed' );
            }

            setFreeDelivery( newValue );
            alert( newValue ? 'Free delivery is now ACTIVE' : 'Free delivery is now OFF' );
        } catch ( e: any )
        {
            console.error( e );
            alert( 'Failed to save setting: ' + e.message );
        } finally
        {
            setSaving( false );
        }
    };

    if ( loading ) return <div className="h-10 bg-stone/20 rounded animate-pulse w-full" />;

    return (
        <div className={ `border p-4 rounded flex items-center justify-between gap-4 ${ freeDelivery ? 'border-emerald-300 bg-emerald-50' : 'border-stone bg-white' }` }>
            <div>
                <p className="text-sm font-semibold">
                    { freeDelivery ? '🎉 Free Delivery Offer — Active' : '₹50 Delivery Charge — Active' }
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                    { freeDelivery
                        ? 'All orders get free delivery right now. Great for promotions & festivals!'
                        : 'Customers pay ₹50 delivery charge on every order (COD + Online both).' }
                </p>
            </div>
            <button
                onClick={ toggle }
                disabled={ saving }
                className={ `shrink-0 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded transition ${ freeDelivery
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white' }` }
            >
                { saving ? 'Saving...' : freeDelivery ? 'Turn Off Free Delivery' : 'Activate Free Delivery Offer' }
            </button>
        </div>
    );
}
