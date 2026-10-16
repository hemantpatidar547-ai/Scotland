const ADMIN_SESSION_COOKIE = 'scotland_admin_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const encoder = new TextEncoder();

function toArrayBuffer ( value: Uint8Array ): ArrayBuffer
{
    const buffer = new ArrayBuffer( value.byteLength );
    new Uint8Array( buffer ).set( value );
    return buffer;
}

function encodeBase64Url ( value: Uint8Array ): string
{
    let binary = '';
    for ( const byte of value ) binary += String.fromCharCode( byte );
    return btoa( binary ).replace( /\+/g, '-' ).replace( /\//g, '_' ).replace( /=+$/, '' );
}

function decodeBase64Url ( value: string ): Uint8Array
{
    const base64 = value.replace( /-/g, '+' ).replace( /_/g, '/' );
    const binary = atob( base64.padEnd( Math.ceil( base64.length / 4 ) * 4, '=' ) );
    return Uint8Array.from( binary, character => character.charCodeAt( 0 ) );
}

async function getSigningKey (): Promise<CryptoKey>
{
    const password = process.env.ADMIN_PASSWORD;
    if ( !password ) throw new Error( 'ADMIN_PASSWORD is not configured.' );

    return crypto.subtle.importKey(
        'raw',
        toArrayBuffer( encoder.encode( password ) ),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        [ 'sign', 'verify' ]
    );
}

export function getAdminSessionCookieName (): string
{
    return ADMIN_SESSION_COOKIE;
}

export function getAdminSessionMaxAge (): number
{
    return SESSION_MAX_AGE_SECONDS;
}

export async function verifyAdminSession ( token: string | undefined ): Promise<boolean>
{
    if ( !token ) return false;

    const parts = token.split( '.' );
    if ( parts.length !== 2 ) return false;

    try
    {
        const [ encodedPayload, encodedSignature ] = parts;
        const payload = JSON.parse( new TextDecoder().decode( decodeBase64Url( encodedPayload ) ) ) as { exp?: number };
        const now = Math.floor( Date.now() / 1000 );
        if ( !Number.isSafeInteger( payload.exp ) || !payload.exp || payload.exp <= now || payload.exp > now + SESSION_MAX_AGE_SECONDS + 60 )
            return false;

        const key = await getSigningKey();
        return await crypto.subtle.verify(
            'HMAC',
            key,
            toArrayBuffer( decodeBase64Url( encodedSignature ) ),
            toArrayBuffer( encoder.encode( encodedPayload ) )
        );
    } catch
    {
        return false;
    }
}

export async function createAdminSession (): Promise<string>
{
    const expiresAt = Math.floor( Date.now() / 1000 ) + SESSION_MAX_AGE_SECONDS;
    const encodedPayload = encodeBase64Url( encoder.encode( JSON.stringify( { exp: expiresAt } ) ) );
    const key = await getSigningKey();
    const signature = await crypto.subtle.sign( 'HMAC', key, toArrayBuffer( encoder.encode( encodedPayload ) ) );
    return `${ encodedPayload }.${ encodeBase64Url( new Uint8Array( signature ) ) }`;
}

export async function verifyAdminPassword ( password: string ): Promise<boolean>
{
    const configuredPassword = process.env.ADMIN_PASSWORD;
    if ( !configuredPassword ) return false;

    const [ submittedHash, configuredHash ] = await Promise.all( [
        crypto.subtle.digest( 'SHA-256', toArrayBuffer( encoder.encode( password ) ) ),
        crypto.subtle.digest( 'SHA-256', toArrayBuffer( encoder.encode( configuredPassword ) ) ),
    ] );
    const submittedBytes = new Uint8Array( submittedHash );
    const configuredBytes = new Uint8Array( configuredHash );
    let difference = 0;
    for ( let index = 0; index < submittedBytes.length; index++ )
        difference |= submittedBytes[ index ] ^ configuredBytes[ index ];
    return difference === 0;
}
