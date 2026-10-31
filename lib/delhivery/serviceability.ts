import 'server-only';

import { getDelhiveryConfig } from '@/lib/delhivery/config';

type JsonRecord = Record<string, unknown>;

export class DelhiveryServiceError extends Error
{
    constructor ( message = 'Delivery availability is temporarily unavailable.' )
    {
        super( message );
        this.name = 'DelhiveryServiceError';
    }
}

export type DelhiveryPinResult = {
    serviceable: boolean;
    codAvailable: boolean;
    prepaidAvailable: boolean;
    district: string | null;
    state: string | null;
};

export type DelhiveryDeliveryEstimate = DelhiveryPinResult & {
    estimatedDeliveryDays: number;
    codCharge: number | null;
    prepaidCharge: number | null;
    chargeableWeightGrams: number;
};

function isRecord ( value: unknown ): value is JsonRecord
{
    return Boolean( value ) && typeof value === 'object' && !Array.isArray( value );
}

function normalizePinRows ( value: unknown ): JsonRecord[] | null
{
    if ( Array.isArray( value ) )
    {
        const rows: JsonRecord[] = [];
        for ( const item of value )
        {
            if ( !isRecord( item ) ) return null;
            const nested = item.postal_code;
            if ( Array.isArray( nested ) )
            {
                for ( const row of nested )
                {
                    if ( !isRecord( row ) ) return null;
                    rows.push( row );
                }
            } else if ( isRecord( nested ) )
            {
                rows.push( nested );
            } else
            {
                rows.push( item );
            }
        }
        return rows;
    }

    if ( !isRecord( value ) ) return null;
    if ( Array.isArray( value.delivery_codes ) ) return normalizePinRows( value.delivery_codes );
    if ( Array.isArray( value.postal_code ) ) return normalizePinRows( [ value ] );
    if ( isRecord( value.postal_code ) ) return [ value.postal_code ];
    if ( Array.isArray( value.data ) ) return normalizePinRows( value.data );
    return null;
}

function parseBooleanFlag ( value: unknown ): boolean | null
{
    if ( typeof value === 'boolean' ) return value;
    if ( typeof value === 'number' ) return value === 1 ? true : value === 0 ? false : null;
    if ( typeof value !== 'string' ) return null;
    const normalized = value.trim().toLowerCase();
    if ( [ 'y', 'yes', 'true', '1', 'available' ].includes( normalized ) ) return true;
    if ( [ 'n', 'no', 'false', '0', 'unavailable' ].includes( normalized ) ) return false;
    return null;
}

function isExplicitlyUnserviceable ( value: unknown ): boolean
{
    if ( typeof value !== 'string' ) return false;
    return /embargo|\\bnsz\\b|non.?serviceable|not serviceable/i.test( value.trim() );
}

function readPaymentAvailability ( row: JsonRecord, fields: string[] ): boolean | null
{
    for ( const field of fields )
    {
        if ( field in row )
        {
            const value = parseBooleanFlag( row[ field ] );
            if ( value !== null ) return value;
        }
    }
    return null;
}

async function fetchDelhiveryJson ( url: URL, apiToken: string ): Promise<unknown>
{
    let response: Response;
    try
    {
        response = await fetch( url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: `Token ${ apiToken }`,
            },
            cache: 'no-store',
            signal: AbortSignal.timeout( 8000 ),
        } );
    } catch
    {
        throw new DelhiveryServiceError();
    }

    if ( !response.ok ) throw new DelhiveryServiceError();
    try
    {
        return await response.json();
    } catch
    {
        throw new DelhiveryServiceError();
    }
}

export async function checkDelhiveryPincode ( pincode: string ): Promise<DelhiveryPinResult>
{
    if ( !/^[0-9]{6}$/.test( pincode ) ) throw new DelhiveryServiceError( 'Enter a valid 6-digit PIN code.' );

    const config = getDelhiveryConfig();
    if ( !config.originPincode || !/^[0-9]{6}$/.test( config.originPincode ) )
        throw new DelhiveryServiceError( 'Delivery checking is temporarily unavailable. Please try again later.' );

    const url = new URL( '/c/api/pin-codes/json/', config.apiBaseUrl );
    url.searchParams.set( 'filter_codes', pincode );
    const response = await fetchDelhiveryJson( url, config.apiToken );
    const rows = normalizePinRows( response );
    if ( !rows ) throw new DelhiveryServiceError();
    if ( rows.length === 0 ) return {
        serviceable: false,
        codAvailable: false,
        prepaidAvailable: false,
        district: null,
        state: null,
    };

    const row = rows.find( candidate =>
        !candidate.pin || String( candidate.pin ).replace( /\D/g, '' ) === pincode
    );
    if ( !row ) return {
        serviceable: false,
        codAvailable: false,
        prepaidAvailable: false,
        district: null,
        state: null,
    };

    const remarks = row.remarks ?? row.remark;
    if ( isExplicitlyUnserviceable( remarks ) ) return {
        serviceable: false,
        codAvailable: false,
        prepaidAvailable: false,
        district: typeof row.district === 'string' ? row.district : null,
        state: typeof row.state_code === 'string' ? row.state_code : null,
    };

    const prepaidAvailable = readPaymentAvailability( row, [ 'pre_paid', 'prepaid', 'prepaid_available' ] );
    const codAvailable = readPaymentAvailability( row, [ 'cod', 'cash', 'cod_available' ] );
    if ( prepaidAvailable === null || codAvailable === null )
        throw new DelhiveryServiceError();

    const hasRemark = remarks === undefined || remarks === null || remarks === '';
    if ( !hasRemark && typeof remarks === 'string' )
        throw new DelhiveryServiceError();

    return {
        serviceable: true,
        codAvailable,
        prepaidAvailable,
        district: typeof row.district === 'string' ? row.district : null,
        state: typeof row.state_code === 'string' ? row.state_code : null,
    };
}

function extractNumericField ( value: unknown, fields: string[] ): number | null
{
    if ( Array.isArray( value ) )
    {
        for ( const item of value )
        {
            const match = extractNumericField( item, fields );
            if ( match !== null ) return match;
        }
        return null;
    }
    if ( !isRecord( value ) ) return null;

    for ( const field of fields )
    {
        if ( field in value )
        {
            const amount = Number( value[ field ] );
            if ( Number.isFinite( amount ) && amount >= 0 ) return amount;
        }
    }
    for ( const child of Object.values( value ) )
    {
        const match = extractNumericField( child, fields );
        if ( match !== null ) return match;
    }
    return null;
}

async function getDelhiveryShippingCharge (
    paymentType: 'COD' | 'Pre-paid',
    pincode: string,
    chargeableWeightGrams: number
): Promise<number>
{
    const config = getDelhiveryConfig();
    if ( !config.originPincode || !/^[0-9]{6}$/.test( config.originPincode ) )
        throw new DelhiveryServiceError();

    const url = new URL( '/api/kinko/v1/invoice/charges/.json', config.apiBaseUrl );
    url.searchParams.set( 'md', 'S' );
    url.searchParams.set( 'ss', 'Delivered' );
    url.searchParams.set( 'd_pin', pincode );
    url.searchParams.set( 'o_pin', config.originPincode );
    url.searchParams.set( 'cgm', String( chargeableWeightGrams ) );
    url.searchParams.set( 'pt', paymentType );
    const response = await fetchDelhiveryJson( url, config.apiToken );
    const amount = extractNumericField( response, [ 'total_amount', 'total_charge', 'totalCharge', 'amount' ] );
    if ( amount === null ) throw new DelhiveryServiceError();
    return Math.round( amount * 100 ) / 100;
}

async function getExpectedDeliveryDays ( pincode: string ): Promise<number>
{
    const config = getDelhiveryConfig();
    if ( !config.originPincode || !/^[0-9]{6}$/.test( config.originPincode ) )
        throw new DelhiveryServiceError();

    const url = new URL( '/api/dc/expected_tat', config.tatApiBaseUrl );
    url.searchParams.set( 'origin_pin', config.originPincode );
    url.searchParams.set( 'destination_pin', pincode );
    url.searchParams.set( 'mot', 'S' );
    url.searchParams.set( 'pdt', 'B2C' );
    const response = await fetchDelhiveryJson( url, config.apiToken );
    const days = extractNumericField( response, [ 'expected_tat', 'tat', 'days', 'expected_delivery_days' ] );
    if ( days === null || days < 1 || days > 90 ) throw new DelhiveryServiceError();
    return Math.ceil( days );
}

export async function getDelhiveryDeliveryEstimate (
    pincode: string,
    chargeableWeightGrams?: number
): Promise<DelhiveryDeliveryEstimate>
{
    const config = getDelhiveryConfig();
    const weight = chargeableWeightGrams ?? config.defaultChargeableWeightGrams;
    if ( !Number.isSafeInteger( weight ) || weight < 1 || weight > 100000 )
        throw new DelhiveryServiceError( 'Enter a valid parcel weight in grams.' );

    const availability = await checkDelhiveryPincode( pincode );
    if ( !availability.serviceable )
    {
        return {
            ...availability,
            estimatedDeliveryDays: 0,
            codCharge: null,
            prepaidCharge: null,
            chargeableWeightGrams: weight,
        };
    }

    const [ codCharge, prepaidCharge, estimatedDeliveryDays ] = await Promise.all( [
        availability.codAvailable ? getDelhiveryShippingCharge( 'COD', pincode, weight ) : Promise.resolve( null ),
        availability.prepaidAvailable ? getDelhiveryShippingCharge( 'Pre-paid', pincode, weight ) : Promise.resolve( null ),
        getExpectedDeliveryDays( pincode ),
    ] );

    return {
        ...availability,
        estimatedDeliveryDays,
        codCharge,
        prepaidCharge,
        chargeableWeightGrams: weight,
    };
}
