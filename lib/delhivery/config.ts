import 'server-only';

export type DelhiveryConfig = {
    apiToken: string;
    apiBaseUrl: string;
    pickupLocation: string;
    originPincode: string | null;
    tatApiBaseUrl: string;
    defaultChargeableWeightGrams: number;
};

export function getDelhiveryConfig (): DelhiveryConfig
{
    const apiToken = process.env.DELHIVERY_API_TOKEN?.trim();
    const apiBaseUrl = process.env.DELHIVERY_API_BASE_URL?.trim();
    const pickupLocation = process.env.DELHIVERY_PICKUP_LOCATION?.trim();
    const originPincode = process.env.DELHIVERY_ORIGIN_PINCODE?.trim() || null;
    const configuredTatApiBaseUrl = process.env.DELHIVERY_TAT_API_BASE_URL?.trim();
    const defaultChargeableWeightGrams = Number( process.env.DELHIVERY_DEFAULT_CHARGEABLE_WEIGHT_G || 500 );

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

    let tatApiBaseUrl = configuredTatApiBaseUrl;
    if ( !tatApiBaseUrl )
    {
        tatApiBaseUrl = host === 'staging-express.delhivery.com'
            ? 'https://express-dev-test.delhivery.com'
            : parsedBaseUrl.origin;
    }

    let parsedTatApiBaseUrl: URL;
    try
    {
        parsedTatApiBaseUrl = new URL( tatApiBaseUrl );
    } catch
    {
        throw new Error( 'DELHIVERY_TAT_API_BASE_URL must be a valid HTTPS Delhivery URL.' );
    }
    if (
        parsedTatApiBaseUrl.protocol !== 'https:' ||
        ( parsedTatApiBaseUrl.hostname.toLowerCase() !== 'delhivery.com' &&
            !parsedTatApiBaseUrl.hostname.toLowerCase().endsWith( '.delhivery.com' ) ) ||
        parsedTatApiBaseUrl.username ||
        parsedTatApiBaseUrl.password ||
        parsedTatApiBaseUrl.search ||
        parsedTatApiBaseUrl.hash
    )
    {
        throw new Error( 'DELHIVERY_TAT_API_BASE_URL must use an official HTTPS Delhivery host without credentials or query parameters.' );
    }
    if ( !Number.isSafeInteger( defaultChargeableWeightGrams ) ||
        defaultChargeableWeightGrams < 1 ||
        defaultChargeableWeightGrams > 100000 )
    {
        throw new Error( 'DELHIVERY_DEFAULT_CHARGEABLE_WEIGHT_G must be an integer from 1 to 100000.' );
    }

    return {
        apiToken,
        apiBaseUrl: parsedBaseUrl.toString().replace( /\/+$/, '' ),
        pickupLocation,
        originPincode,
        tatApiBaseUrl: parsedTatApiBaseUrl.toString().replace( /\/+$/, '' ),
        defaultChargeableWeightGrams,
    };
}
