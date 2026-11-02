import 'server-only';

import { Cashfree, CFEnvironment } from 'cashfree-pg';

export const CASHFREE_API_VERSION = '2026-01-01';

export function getCashfreeClient ()
{
    const clientId = process.env.CASHFREE_CLIENT_ID;
    const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
    const environment = process.env.CASHFREE_ENV || 'sandbox';

    if ( !clientId || !clientSecret )
    {
        throw new Error( 'Cashfree server credentials are not configured.' );
    }

    if ( environment !== 'sandbox' && environment !== 'production' )
    {
        throw new Error( 'CASHFREE_ENV must be either sandbox or production.' );
    }

    const client = new Cashfree(
        environment === 'production' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
        clientId,
        clientSecret
    );
    client.XApiVersion = CASHFREE_API_VERSION;
    return client;
}

export function getCashfreeCheckoutMode (): 'sandbox' | 'production'
{
    const mode = process.env.NEXT_PUBLIC_CASHFREE_MODE || 'sandbox';
    const serverMode = process.env.CASHFREE_ENV || 'sandbox';
    if ( mode !== 'sandbox' && mode !== 'production' )
        throw new Error( 'NEXT_PUBLIC_CASHFREE_MODE must be either sandbox or production.' );
    if ( serverMode !== mode )
        throw new Error( 'Cashfree server and checkout environments must match.' );
    return mode;
}
