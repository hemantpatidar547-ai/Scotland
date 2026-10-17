'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { disableGoogleAnalytics, enableGoogleAnalytics } from '@/lib/analytics';

const CONSENT_KEY = 'scotland-analytics-consent';

export function ConsentAwareAnalytics ()
{
    const pathname = usePathname();
    const [ consent, setConsent ] = useState<string | null>( null );
    const [ settingsOpen, setSettingsOpen ] = useState( false );
    const hasMeasurementId = Boolean( process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID );

    useEffect( () =>
    {
        setConsent( window.localStorage.getItem( CONSENT_KEY ) );
    }, [] );

    useEffect( () =>
    {
        if ( consent === 'accepted' ) enableGoogleAnalytics();
    }, [ consent ] );

    if ( pathname.startsWith( '/admin' ) || !hasMeasurementId ) return null;

    function choose ( value: 'accepted' | 'rejected' )
    {
        window.localStorage.setItem( CONSENT_KEY, value );
        if ( value === 'rejected' ) disableGoogleAnalytics();
        setConsent( value );
        setSettingsOpen( false );
    }

    if ( consent && !settingsOpen )
    {
        return <button type="button" onClick={ () => setSettingsOpen( true ) } className="fixed bottom-3 left-3 z-[60] rounded-full border border-stone bg-white px-3 py-2 text-xs text-zinc-600 shadow-sm">Privacy settings</button>;
    }

    return (
        <aside aria-label="Analytics privacy choices" className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl border border-stone bg-white p-4 shadow-xl sm:inset-x-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
                <p className="text-sm font-semibold text-navy">Analytics choices</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">We use Google Analytics only if you accept. We do not send your name, email, delivery address, or payment details. You can change your choice in Privacy settings.</p>
            </div>
            <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
                <button type="button" onClick={ () => choose( 'rejected' ) } className="button-outline px-3 py-2 text-xs">Reject</button>
                <button type="button" onClick={ () => choose( 'accepted' ) } className="button px-3 py-2 text-xs">Accept analytics</button>
            </div>
        </aside>
    );
}
