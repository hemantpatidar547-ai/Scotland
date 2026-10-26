'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CancelOrderButton ( { orderId, prepaid }: { orderId: string; prepaid: boolean } )
{
    const router = useRouter();
    const [ pending, setPending ] = useState( false );
    const [ error, setError ] = useState( '' );

    async function cancelOrder ()
    {
        const refundNotice = prepaid
            ? '\n\nThis order was paid online. Cancellation will not automatically refund the payment; the store admin will process the refund manually.'
            : '';
        if ( !window.confirm( `Cancel this order?${ refundNotice }` ) ) return;

        setPending( true );
        setError( '' );
        try
        {
            const response = await fetch( `/api/orders/${ encodeURIComponent( orderId ) }/cancel`, { method: 'POST' } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not cancel this order.' );
            router.refresh();
        } catch ( cause )
        {
            setError( cause instanceof Error ? cause.message : 'Could not cancel this order.' );
            setPending( false );
        }
    }

    return <div className="mt-5 border-t border-stone pt-5">
        <button type="button" className="button-outline border-rose-300 text-rose-800 hover:bg-rose-50 disabled:opacity-50" onClick={ cancelOrder } disabled={ pending }>
            { pending ? 'Cancelling…' : 'Cancel order' }
        </button>
        { prepaid && <p className="mt-2 text-xs leading-5 text-zinc-500">Online refunds are processed manually by the store after cancellation.</p> }
        { error && <p className="mt-3 text-sm text-rose-700" role="alert">{ error }</p> }
    </div>;
}
