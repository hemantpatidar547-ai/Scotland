'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type ReturnableItem = {
    name?: string;
    size?: string;
    color?: string;
    quantity?: number;
    price?: number;
    totalPrice?: number;
};

type ReturnQuote = {
    returnShippingCharge: number;
    refundAmount: number;
};

export function ReturnOrderForm (
    { orderId, items }: {
        orderId: string;
        items: ReturnableItem[];
    }
)
{
    const router = useRouter();
    const [ reason, setReason ] = useState( '' );
    const [ selectedItems, setSelectedItems ] = useState<number[]>( [] );
    const [ pending, setPending ] = useState( false );
    const [ error, setError ] = useState( '' );
    const [ quote, setQuote ] = useState<ReturnQuote | null>( null );
    const [ quoteLoading, setQuoteLoading ] = useState( false );
    const [ quoteError, setQuoteError ] = useState( '' );
    const [ quoteAttempt, setQuoteAttempt ] = useState( 0 );

    useEffect( () =>
    {
        if ( selectedItems.length === 0 )
        {
            setQuote( null );
            setQuoteLoading( false );
            setQuoteError( '' );
            return;
        }

        const controller = new AbortController();
        setQuote( null );
        setQuoteLoading( true );
        setQuoteError( '' );
        fetch( `/api/orders/${ encodeURIComponent( orderId ) }/return/quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( { itemIndexes: selectedItems } ),
            signal: controller.signal,
        } )
            .then( async response =>
            {
                const result = await response.json();
                if ( !response.ok ) throw new Error( result.error || 'Could not check the return courier charge.' );
                setQuote( {
                    returnShippingCharge: Number( result.returnShippingCharge ),
                    refundAmount: Number( result.refundAmount ),
                } );
            } )
            .catch( cause =>
            {
                if ( !controller.signal.aborted )
                    setQuoteError( cause instanceof Error ? cause.message : 'Could not check the return courier charge.' );
            } )
            .finally( () =>
            {
                if ( !controller.signal.aborted ) setQuoteLoading( false );
            } );

        return () => controller.abort();
    }, [ orderId, selectedItems, quoteAttempt ] );

    async function submit ( event: FormEvent<HTMLFormElement> )
    {
        event.preventDefault();
        if ( selectedItems.length === 0 )
        {
            setError( 'Select at least one product to return.' );
            return;
        }
        if ( !quote || quoteLoading )
        {
            setError( quoteError || 'Wait for the courier to calculate the return charge before submitting.' );
            return;
        }
        if ( !window.confirm( `Submit return request?\n\nSelected products: ${ selectedItems.length }\nReturn courier charge (deducted from refund): ₹${ quote.returnShippingCharge.toLocaleString( 'en-IN' ) }\nEstimated refund: ₹${ quote.refundAmount.toLocaleString( 'en-IN' ) }\nThe original delivery charge is not refundable. Refund is processed after the returned items are received and checked.` ) )
            return;

        setPending( true );
        setError( '' );
        try
        {
            const response = await fetch( `/api/orders/${ encodeURIComponent( orderId ) }/return`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { reason, itemIndexes: selectedItems } ),
            } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not submit return request.' );
            router.refresh();
        } catch ( cause )
        {
            setError( cause instanceof Error ? cause.message : 'Could not submit return request.' );
            setPending( false );
        }
    }

    return <form onSubmit={ submit } className="mt-5 border-t border-stone pt-5">
        <label className="block text-sm font-semibold" htmlFor="return-reason">Request a return</label>
        <p className="mt-1 text-xs leading-5 text-zinc-600">Available within 48 hours of delivery. The courier API checks the return delivery charge from your PIN code back to our warehouse. This quoted amount is deducted from the refund; the original delivery charge is not refundable.</p>
        <fieldset className="mt-3 space-y-2">
            <legend className="text-sm font-medium">Choose products</legend>
            { items.map( ( item, index ) => <label key={ `${ item.name }-${ index }` } className="flex items-start gap-2 border border-stone p-3 text-sm">
                <input
                    className="mt-1"
                    type="checkbox"
                    checked={ selectedItems.includes( index ) }
                    onChange={ event => setSelectedItems( current => event.target.checked
                        ? [ ...current, index ]
                        : current.filter( selectedIndex => selectedIndex !== index ) ) }
                />
                <span>{ item.name || 'Product' } · { item.color } · { item.size } · Qty { item.quantity || 1 }</span>
            </label> ) }
        </fieldset>
        { selectedItems.length > 0 && <div className="mt-3 border border-stone bg-white p-3 text-sm" aria-live="polite">
            { quoteLoading ? <p className="text-zinc-600">Checking return courier charge…</p> : quoteError ? (
                <p className="text-rose-700">{ quoteError }</p>
            ) : quote && <>
                <p>Return courier charge (deducted): <span className="font-medium">₹{ quote.returnShippingCharge.toLocaleString( 'en-IN' ) }</span></p>
                <p className="mt-1">Estimated refund: <span className="font-medium">₹{ quote.refundAmount.toLocaleString( 'en-IN' ) }</span></p>
                <p className="mt-1 text-xs text-zinc-500">The final courier charge may change if the parcel weight or dimensions differ when collected.</p>
            </> }
        </div> }
        { quoteError && <button
            type="button"
            className="mt-2 text-sm underline"
            onClick={ () => setQuoteAttempt( attempt => attempt + 1 ) }
        >Try checking the courier charge again</button> }
        <textarea
            id="return-reason"
            className="mt-3 w-full border border-stone px-3 py-2 text-sm"
            minLength={ 5 }
            maxLength={ 500 }
            required
            value={ reason }
            onChange={ event => setReason( event.target.value ) }
            placeholder="Tell us why you are returning the order"
        />
        { quoteError && <p className="mt-2 text-sm text-rose-700" role="alert">{ quoteError }</p> }
        { error && <p className="mt-2 text-sm text-rose-700" role="alert">{ error }</p> }
        <button type="submit" className="button-outline mt-3 border-rose-300 text-rose-800 hover:bg-rose-50 disabled:opacity-50" disabled={ pending || quoteLoading || !quote }>
            { pending ? 'Submitting…' : quoteLoading ? 'Checking courier charge…' : quote ? `Request return · Est. refund ₹${ quote.refundAmount.toLocaleString( 'en-IN' )}` : 'Check return courier charge' }
        </button>
    </form>;
}
