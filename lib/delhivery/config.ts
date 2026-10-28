import 'server-only';

export type DelhiveryConfig = {
    apiToken: string;
    apiBaseUrl: string;
    pickupLocation: string;
};

export function getDelhiveryConfig (): DelhiveryConfig
{
    const apiToken = process.env.DELHIVERY_API_TOKEN?.trim();
    const apiBaseUrl = process.env.DELHIVERY_API_BASE_URL?.trim();
    const pickupLocation = process.env.DELHIVERY_PICKUP_LOCATION?.trim();

    if ( !apiToken || !apiBaseUrl || !pickupLocation )
    {
        throw new Error( 'Delhivery sandbox is not configured. Set DELHIVERY_API_TOKEN, DELHIVERY_API_BASE_URL, and DELHIVERY_PICKUP_LOCATION on the server.' );
    }

    let parsedBaseUrl: URL;
    try
    {
        parsedBaseUrl = new URL( apiBaseUrl );
    } catch
    {
        throw new Error( 'DELHIVERY_API_BASE_URL must be a valid HTTPS Delhivery URL.' );
    }

    const host = parsedBaseUrl.hostname.toLowerCase();
    if (
        parsedBaseUrl.protocol !== 'https:' ||
        ( host !== 'delhivery.com' && !host.endsWith( '.delhivery.com' ) ) ||
        parsedBaseUrl.username ||
        parsedBaseUrl.password ||
        parsedBaseUrl.search ||
        parsedBaseUrl.hash
    )
    {
        throw new Error( 'DELHIVERY_API_BASE_URL must use an official HTTPS Delhivery host without credentials or query parameters.' );
    }

    return {
        apiToken,
        apiBaseUrl: parsedBaseUrl.toString().replace( /\/+$/, '' ),
        pickupLocation,
    };
}
