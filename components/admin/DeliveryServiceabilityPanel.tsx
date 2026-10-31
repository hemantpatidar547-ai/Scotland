'use client';

import { FormEvent, useState } from 'react';

type ServiceabilityResult = {
    status: 'available' | 'unavailable';
    message: string;
    estimatedDeliveryDays: number | null;
    chargeableWeightGrams: number;
    district: string | null;
    state: string | null;
    cod: { available: boolean; courierCharge: number | null };
    prepaid: { available: boolean; courierCharge: number | null };
};

const money = ( amount: number ) => new Intl.NumberFormat( 'en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
} ).format( amount );

export default function DeliveryServiceabilityPanel ()
{
    const [ pincode, setPincode ] = useState( '' );
    const [ weight, setWeight ] = useState( '500' );
    const [ result, setResult ] = useState<ServiceabilityResult | null>( null );
    const [ loading, setLoading ] = useState( false );
    const [ error, setError ] = useState( '' );

    async function checkDelivery ( event: FormEvent )
    {
        event.preventDefault();
        setResult( null );
        setError( '' );
        setLoading( true );

        try
        {
            const response = await fetch( '/api/delivery/serviceability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( {
                    pincode,
                    chargeableWeightGrams: Number( weight ),
                } ),
            } );
            const data = await response.json();
            if ( !response.ok ) throw new Error( data.error || 'Could not check delivery serviceability.' );
            setResult( data as ServiceabilityResult );
        } catch ( cause )
        {
            setError( cause instanceof Error ? cause.message : 'Delivery availability is temporarily unavailable.' );
        } finally
        {
            setLoading( false );
        }
    }

    return <section className="mt-6 border border-stone bg-white p-5 shadow-sm sm:p-6">
        <div className="border-b border-stone pb-4">
            <p className="eyebrow text-zinc-500">Delivery management</p>
            <h2 className="display mt-2 text-2xl text-navy">PIN code serviceability</h2>
            <p className="mt-1 text-sm text-zinc-600">Check Delhivery availability, COD/prepaid support, estimated transit time, and carrier rates.</p>
        </div>

        <form onSubmit={ checkDelivery } className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block text-xs font-medium text-zinc-600">
                Destination PIN code
                <input
                    className="input mt-1"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={ 6 }
                    minLength={ 6 }
                    required
                    value={ pincode }
                    onChange={ event =>
                    {
                        setPincode( event.target.value.replace( /\D/g, '' ).slice( 0, 6 ) );
                        setResult( null );
                    } }
                    placeholder="6-digit PIN"
                />
            </label>
            <label className="block text-xs font-medium text-zinc-600">
                Chargeable parcel weight (grams)
                <input
                    className="input mt-1"
                    type="number"
                    min={ 1 }
                    max={ 100000 }
                    step={ 1 }
                    required
                    value={ weight }
                    onChange={ event =>
                    {
                        setWeight( event.target.value );
                        setResult( null );
                    } }
                />
            </label>
            <button type="submit" className="button min-h-11 disabled:opacity-50" disabled={ loading || pincode.length !== 6 || !Number.isSafeInteger( Number( weight ) ) || Number( weight ) < 1 || Number( weight ) > 100000 }>
                { loading ? 'Checking…' : 'Check delivery' }
            </button>
        </form>

        { error && <p className="mt-4 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">{ error } This is a temporary check failure, not a confirmed unavailable PIN code.</p> }

        { result?.status === 'unavailable' && (
            <p className="mt-4 border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800" role="status">
                Sorry, delivery is not available at this PIN code.
            </p>
        ) }

        { result?.status === 'available' && (
            <div className="mt-4 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950" role="status">
                <p className="font-semibold">Delivery Available</p>
                <p className="mt-1 text-xs">
                    { [ result.district, result.state ].filter( Boolean ).join( ', ' ) || `PIN ${ pincode }` }
                    { ` · Estimated ${ result.estimatedDeliveryDays } days after courier handover · ${ result.chargeableWeightGrams } g rated` }
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <p className="border border-emerald-200 bg-white/70 p-3">
                        <span className="font-medium">Prepaid:</span>{ ' ' }
                        { result.prepaid.available
                            ? result.prepaid.courierCharge === null ? 'Rate unavailable' : `Available · ${ money( result.prepaid.courierCharge ) } carrier estimate`
                            : 'Not available' }
                    </p>
                    <p className="border border-emerald-200 bg-white/70 p-3">
                        <span className="font-medium">Cash on Delivery:</span>{ ' ' }
                        { result.cod.available
                            ? result.cod.courierCharge === null ? 'Rate unavailable' : `Available · ${ money( result.cod.courierCharge ) } carrier estimate`
                            : 'Not available' }
                    </p>
                </div>
                <p className="mt-2 text-[11px] text-zinc-600">Carrier rates are estimates from Delhivery and may change at shipment booking.</p>
            </div>
        ) }
    </section>;
}
