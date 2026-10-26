'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type ReturnableItem = {
    name?: string;
    size?: string;
    color?: string;
    quantity?: number;
    price?: number;
    totalPrice?: number;
};

export function ReturnOrderForm (
    { orderId, items, couponDiscount, orderTotal, deliveryCharge }: {
        orderId: string;
        items: ReturnableItem[];
        couponDiscount: number;
        orderTotal: number;
        deliveryCharge: number;
    }
)
{
    const router = useRouter();
    const [ reason, setReason ] = useState( '' );
    const [ selectedItems, setSelectedItems ] = useState<number[]>( [] );
    const [ pending, setPending ] = useState( false );
    const [ error, setError ] = useState( '' );
    const subtotal = items.reduce( ( sum, item ) => sum + Number( item.totalPrice ?? Number( item.price || 0 ) * Number( item.quantity || 1 ) ), 0 );
    const selectedSubtotal = selectedItems.reduce( ( sum, index ) =>
    {
        const item = items[ index ];
        return sum + Number( item?.totalPrice ?? Number( item?.price || 0 ) * Number( item?.quantity || 1 ) );
    }, 0 );
    const discountShare = subtotal > 0 ? couponDiscount * selectedSubtotal / subtotal : 0;
    const estimatedRefund = Math.max( 0, Math.min(
        selectedSubtotal - discountShare - 35,
        orderTotal - deliveryCharge
    ) );

    async function submit ( event: FormEvent<HTMLFormElement> )
    {
        event.preventDefault();
        if ( selectedItems.length === 0 )
        {
            setError( 'Select at least one product to return.' );
            return;
        }
        if ( !window.confirm( `Submit return request?\n\nSelected products: ${ selectedItems.length }\nEstimated refund: ₹${ estimatedRefund.toLocaleString( 'en-IN' ) }\n₹35 return handling fee will be deducted once for all selected products. Original delivery charge is not refundable. Refund is processed after the returned items are received and checked.` ) )
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
        <p className="mt-1 text-xs leading-5 text-zinc-600">Available within 48 hours of delivery. Select the products to return. ₹35 is deducted once per return parcel, even if it contains multiple products; delivery charge is not refunded. Refund follows after the returned items are received and checked.</p>
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
        { error && <p className="mt-2 text-sm text-rose-700" role="alert">{ error }</p> }
        <button type="submit" className="button-outline mt-3 border-rose-300 text-rose-800 hover:bg-rose-50 disabled:opacity-50" disabled={ pending }>
            { pending ? 'Submitting…' : `Request return · Est. refund ₹${ estimatedRefund.toLocaleString( 'en-IN' )}` }
        </button>
    </form>;
}
