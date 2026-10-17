const CONSENT_KEY = 'scotland-analytics-consent';

declare global
{
    interface Window
    {
        dataLayer?: unknown[][];
        gtag?: ( ...args: unknown[] ) => void;
    }
}

export function enableGoogleAnalytics ()
{
    if ( typeof window === 'undefined' || !process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ) return;
    if ( window.localStorage.getItem( CONSENT_KEY ) !== 'accepted' ) return;

    if ( !window.gtag )
    {
        window.dataLayer = window.dataLayer || [];
        window.gtag = ( ...args: unknown[] ) => window.dataLayer!.push( args );
        window.gtag( 'js', new Date() );
        window.gtag( 'consent', 'update', { analytics_storage: 'granted' } );
        window.gtag( 'config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, { anonymize_ip: true } );
    }

    if ( !document.getElementById( 'scotland-ga-script' ) )
    {
        const script = document.createElement( 'script' );
        script.id = 'scotland-ga-script';
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${ encodeURIComponent( process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ) }`;
        document.head.appendChild( script );
    }
}

export function disableGoogleAnalytics ()
{
    if ( typeof window === 'undefined' || !window.gtag ) return;
    window.gtag( 'consent', 'update', { analytics_storage: 'denied' } );
}

export function trackAnalyticsEvent ( name: string, parameters: Record<string, unknown> )
{
    if ( typeof window === 'undefined' || window.localStorage.getItem( CONSENT_KEY ) !== 'accepted' ) return;
    enableGoogleAnalytics();
    window.gtag?.( 'event', name, parameters );
}
