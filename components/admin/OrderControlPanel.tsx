'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_ORDER_PAUSE_MESSAGE } from '@/lib/order-control-shared';

type StoreSettings = {
    orderPaused: boolean;
    orderPauseMessage: string;
};

export function OrderControlPanel ()
{
    const [ published, setPublished ] = useState<StoreSettings>( {
        orderPaused: false,
        orderPauseMessage: DEFAULT_ORDER_PAUSE_MESSAGE,
    } );
    const [ orderPaused, setOrderPaused ] = useState( false );
    const [ message, setMessage ] = useState( DEFAULT_ORDER_PAUSE_MESSAGE );
    const [ loading, setLoading ] = useState( true );
    const [ saving, setSaving ] = useState( false );
    const [ previewOpen, setPreviewOpen ] = useState( false );
    const [ error, setError ] = useState( '' );
    const [ loadError, setLoadError ] = useState( '' );
    const [ notice, setNotice ] = useState( '' );

    useEffect( () =>
    {
        fetch( '/api/settings', { cache: 'no-store' } )
            .then( async response =>
            {
                const result = await response.json();
                if ( !response.ok ) throw new Error( result.error || 'Could not load order control settings.' );
                const settings = {
                    orderPaused: result.orderPaused === true,
                    orderPauseMessage: typeof result.orderPauseMessage === 'string'
                        ? result.orderPauseMessage
                        : DEFAULT_ORDER_PAUSE_MESSAGE,
                };
                setPublished( settings );
                setOrderPaused( settings.orderPaused );
                setMessage( settings.orderPauseMessage );
            } )
            .catch( cause => setLoadError( cause instanceof Error ? cause.message : 'Could not load order control settings.' ) )
            .finally( () => setLoading( false ) );
    }, [] );

    async function publish ()
    {
        const trimmedMessage = message.trim();
        if ( !trimmedMessage )
        {
            setError( 'Enter a customer message before publishing.' );
            return;
        }

        setSaving( true );
        setError( '' );
        setNotice( '' );
        try
        {
            const response = await fetch( '/api/admin/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( {
                    orderPaused,
                    orderPauseMessage: trimmedMessage,
                } ),
            } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not publish order control settings.' );

            const nextPublished = {
                orderPaused: result.orderPaused === true,
                orderPauseMessage: result.orderPauseMessage,
            };
            setPublished( nextPublished );
            setOrderPaused( nextPublished.orderPaused );
            setMessage( nextPublished.orderPauseMessage );
            setNotice( nextPublished.orderPaused
                ? 'Orders are paused. The restriction is active across the store.'
                : 'Orders are open. Customers can place orders normally.' );
        } catch ( cause )
        {
            setError( cause instanceof Error ? cause.message : 'Could not publish order control settings.' );
        } finally
        {
            setSaving( false );
        }
    }

    if ( loading ) return <p className="mt-4 text-sm text-zinc-500">Loading order control settings…</p>;
    if ( loadError ) return <section className="border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900" role="alert">
        <h2 className="font-semibold">Order Control is unavailable</h2>
        <p className="mt-2">{ loadError }</p>
        <p className="mt-2">Apply <code>supabase/migrations/0024_order_control.sql</code> in the Supabase SQL Editor, then reload this page.</p>
    </section>;

    return <>
        <section className={ `border p-5 shadow-sm sm:p-6 ${ published.orderPaused ? 'border-rose-300 bg-rose-50' : 'border-stone bg-white' }` }>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="display text-2xl text-navy">Order Control</h2>
                    <p className="mt-1 text-sm text-zinc-600">Pause all new COD and online orders without affecting browsing or existing orders.</p>
                </div>
                <p className={ `w-fit rounded-full px-3 py-1 text-xs font-semibold ${ published.orderPaused ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800' }` } role="status">
                    Published status: { published.orderPaused ? 'ORDERS PAUSED' : 'ORDERS OPEN' }
                </p>
            </div>

            <label className="mt-5 flex items-center gap-3 text-sm font-semibold">
                <input
                    type="checkbox"
                    checked={ orderPaused }
                    onChange={ event =>
                    {
                        setOrderPaused( event.target.checked );
                        setError( '' );
                        setNotice( '' );
                    } }
                />
                Pause new orders
            </label>

            <label className="mt-4 block text-sm font-medium" htmlFor="order-pause-message">Customer message</label>
            <textarea
                id="order-pause-message"
                className="mt-2 min-h-28 w-full border border-stone bg-white px-3 py-2 text-sm"
                minLength={ 1 }
                maxLength={ 500 }
                required
                value={ message }
                onChange={ event =>
                {
                    setMessage( event.target.value );
                    setError( '' );
                    setNotice( '' );
                } }
            />
            <p className="mt-1 text-xs text-zinc-500">{ message.length }/500 characters</p>

            { error && <p className="mt-3 text-sm text-rose-700" role="alert">{ error }</p> }
            { notice && <p className="mt-3 text-sm text-emerald-800" role="status">{ notice }</p> }

            <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" className="button" onClick={ () => void publish() } disabled={ saving }>
                    { saving ? 'Publishing…' : 'Save & Publish' }
                </button>
                <button type="button" className="button-outline" onClick={ () => setPreviewOpen( true ) }>
                    Preview Message
                </button>
            </div>
        </section>

        { previewOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={ event =>
            {
                if ( event.target === event.currentTarget ) setPreviewOpen( false );
            } }>
            <section className="w-full max-w-md border border-stone bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="order-pause-preview-title">
                <p className="eyebrow text-zinc-500">Store notice preview</p>
                <h2 id="order-pause-preview-title" className="display mt-2 text-2xl text-navy">Orders temporarily paused</h2>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{ message.trim() || DEFAULT_ORDER_PAUSE_MESSAGE }</p>
                <button type="button" className="button mt-6 w-full" onClick={ () => setPreviewOpen( false ) }>Close preview</button>
            </section>
        </div> }
    </>;
}
