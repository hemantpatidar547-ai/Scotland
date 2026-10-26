import 'server-only';

export type DelhiveryConfig = {
    apiToken: string;
    apiBaseUrl: string;
};

export function getDelhiveryConfig (): DelhiveryConfig
{
    const apiToken = process.env.DELHIVERY_API_TOKEN?.trim();
    const apiBaseUrl = process.env.DELHIVERY_API_BASE_URL?.trim();

    if ( !apiToken || !apiBaseUrl )
    {
        throw new Error( 'Delhivery is not configured. Set DELHIVERY_API_TOKEN and DELHIVERY_API_BASE_URL on the server.' );
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
    };
}
