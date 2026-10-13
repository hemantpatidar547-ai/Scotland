/**
 * Custom JWT Authentication for OTP-based login.
 * Uses native Node.js crypto — no external dependencies needed.
 * SERVER-ONLY — never run in edge / client bundles.
 */

import 'server-only';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'scotland-dev-secret-key-change-in-production';
const TOKEN_COOKIE = 'scotland-auth-token';
const TOKEN_EXPIRY_HOURS = 72; // 3 days

export type OTPUser = {
    id: string;
    mobile: string;
    name: string;
    email: string;
    role: 'customer' | 'admin';
};

function base64UrlEncode ( data: string ): string
{
    return Buffer.from( data ).toString( 'base64url' );
}

function base64UrlDecode ( data: string ): string
{
    return Buffer.from( data, 'base64url' ).toString( 'utf-8' );
}

function signPayload ( headerAndPayload: string ): string
{
    return crypto
        .createHmac( 'sha256', JWT_SECRET )
        .update( headerAndPayload )
        .digest( 'base64url' );
}

export function createToken ( user: OTPUser ): string
{
    const header = base64UrlEncode( JSON.stringify( { alg: 'HS256', typ: 'JWT' } ) );
    const payload = base64UrlEncode( JSON.stringify( {
        sub: user.id,
        mobile: user.mobile,
        name: user.name,
        email: user.email,
        role: user.role,
        iat: Math.floor( Date.now() / 1000 ),
        exp: Math.floor( Date.now() / 1000 ) + ( TOKEN_EXPIRY_HOURS * 3600 ),
    } ) );

    const signature = signPayload( `${ header }.${ payload }` );
    return `${ header }.${ payload }.${ signature }`;
}

export function verifyToken ( token: string ): OTPUser | null
{
    try
    {
        const parts = token.split( '.' );
        if ( parts.length !== 3 ) return null;

        const [ header, payload, signature ] = parts;
        const expectedSignature = signPayload( `${ header }.${ payload }` );

        // Timing-safe comparison
        const sigBuffer = Buffer.from( signature );
        const expectedBuffer = Buffer.from( expectedSignature );
        if ( sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual( sigBuffer, expectedBuffer ) )
        {
            return null;
        }

        const decoded = JSON.parse( base64UrlDecode( payload ) );

        // Check expiry
        if ( decoded.exp && decoded.exp < Math.floor( Date.now() / 1000 ) )
        {
            return null;
        }

        return {
            id: decoded.sub,
            mobile: decoded.mobile,
            name: decoded.name,
            email: decoded.email || '',
            role: decoded.role || 'customer',
        };
    } catch
    {
        return null;
    }
}

export async function setAuthCookie ( user: OTPUser ): Promise<string>
{
    const token = createToken( user );
    const cookieStore = await cookies();
    cookieStore.set( TOKEN_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: TOKEN_EXPIRY_HOURS * 3600,
    } );
    return token;
}

export async function clearAuthCookie (): Promise<void>
{
    const cookieStore = await cookies();
    cookieStore.set( TOKEN_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    } );
}

export async function getOTPUser (): Promise<OTPUser | null>
{
    try
    {
        const cookieStore = await cookies();
        const tokenCookie = cookieStore.get( TOKEN_COOKIE );
        if ( !tokenCookie?.value ) return null;
        return verifyToken( tokenCookie.value );
    } catch
    {
        return null;
    }
}

/**
 * Get the token value from a cookie string (for middleware use).
 */
export function getTokenFromCookieHeader ( cookieHeader: string | null ): string | null
{
    if ( !cookieHeader ) return null;
    const match = cookieHeader.match( new RegExp( `(?:^|;\\s*)${ TOKEN_COOKIE }=([^;]+)` ) );
    return match ? match[ 1 ] : null;
}
