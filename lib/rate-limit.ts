import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/db';

type RateLimitOptions = {
    scope: string;
    limit: number;
    windowSeconds: number;
    subject?: string;
};

function hashIdentifier ( value: string, secret: string ): string
{
    return createHmac( 'sha256', secret ).update( value ).digest( 'hex' );
}

function getClientIp ( request: Request ): string
{
    const realIp = request.headers.get( 'x-real-ip' )?.trim();
    if ( realIp ) return realIp;

    const forwardedFor = request.headers.get( 'x-forwarded-for' );
    return forwardedFor?.split( ',' )[ 0 ]?.trim() || 'unknown';
}

export async function enforceRateLimit (
    request: Request,
    { scope, limit, windowSeconds, subject }: RateLimitOptions
): Promise<NextResponse | null>
{
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if ( !secret )
    {
        console.error( 'Rate limiting is unavailable because SUPABASE_SERVICE_ROLE_KEY is not configured.' );
        return NextResponse.json( { error: 'Service temporarily unavailable.' }, { status: 503 } );
    }

    const ipKey = `${ scope }:ip:${ hashIdentifier( getClientIp( request ), secret ) }`;
    const buckets = [ ipKey ];
    if ( subject )
    {
        buckets.push( `${ scope }:subject:${ hashIdentifier( subject.trim().toLowerCase(), secret ) }` );
    }

    try
    {
        const db = getSupabaseAdmin();
        let retryAfter = 0;

        for ( const bucket of buckets )
        {
            const { data, error } = await db.rpc( 'consume_api_rate_limit', {
                p_bucket: bucket,
                p_limit: limit,
                p_window_seconds: windowSeconds,
            } );
            if ( error ) throw error;

            const result = Array.isArray( data ) ? data[ 0 ] : data;
            if ( !result || typeof result.allowed !== 'boolean' || !Number.isInteger( result.retry_after_seconds ) )
            {
                throw new Error( 'Rate limit RPC returned an invalid response.' );
            }

            if ( !result.allowed ) retryAfter = Math.max( retryAfter, result.retry_after_seconds );
        }

        if ( retryAfter > 0 )
        {
            return NextResponse.json(
                { error: 'Too many requests. Please wait before trying again.' },
                { status: 429, headers: { 'Retry-After': String( retryAfter ) } }
            );
        }

        return null;
    } catch ( error )
    {
        console.error( 'Rate limiter request failed:', error );
        return NextResponse.json(
            { error: 'Service temporarily unavailable.' },
            { status: 503, headers: { 'Retry-After': '30' } }
        );
    }
}
