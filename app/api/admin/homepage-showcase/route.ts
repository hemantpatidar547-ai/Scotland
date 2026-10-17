import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminRequest } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { DEFAULT_HOMEPAGE_SHOWCASE } from '@/types/homepage-showcase';

export const dynamic = 'force-dynamic';

const imageSchema = z.string().trim().min(1).max(2048).refine( value =>
{
    if ( value.startsWith( '/' ) )
        return !value.startsWith( '//' ) && !value.includes( '\\' ) && !value.split( '/' ).includes( '..' );

    try
    {
        const url = new URL( value );
        return url.protocol === 'https:' || ( url.protocol === 'http:' && [ 'localhost', '127.0.0.1' ].includes( url.hostname ) );
    } catch
    {
        return false;
    }
}, 'Use a site image path or a public HTTPS image URL.' );

const showcaseSchema = z.object( {
    enabled: z.boolean(),
    eyebrow: z.string().trim().max( 80 ),
    title: z.string().trim().min( 1 ).max( 120 ),
    description: z.string().trim().min( 1 ).max( 500 ),
    badge: z.string().trim().max( 80 ),
    cards: z.array( z.object( {
        image: imageSchema,
        title: z.string().trim().min( 1 ).max( 120 ),
        detail: z.string().trim().min( 1 ).max( 300 ),
    } ) ).min( 1 ).max( 8 ),
} );

function missingMigration ( error: { code?: string } )
{
    return error.code === '42703' || error.code === 'PGRST204';
}

export async function GET ()
{
    if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    try
    {
        const db = getSupabaseAdmin();
        const { data, error } = await db.from( 'settings' )
            .select( 'homepage_showcase' )
            .eq( 'id', 'store' )
            .maybeSingle();
        if ( error )
        {
            if ( missingMigration( error ) )
                return NextResponse.json( { error: 'Run supabase/migrations/0007_homepage_showcase.sql in the Supabase SQL Editor before editing homepage content.' }, { status: 503 } );
            throw error;
        }

        return NextResponse.json( data?.homepage_showcase
            ? { ...DEFAULT_HOMEPAGE_SHOWCASE, ...data.homepage_showcase }
            : DEFAULT_HOMEPAGE_SHOWCASE );
    } catch ( error )
    {
        console.error( 'Could not load admin homepage content:', error );
        return NextResponse.json( { error: 'Could not load homepage content.' }, { status: 500 } );
    }
}

export async function PATCH ( request: Request )
{
    if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    let body: unknown;
    try
    {
        body = await request.json();
    } catch
    {
        return NextResponse.json( { error: 'Send valid JSON homepage content.' }, { status: 400 } );
    }

    const parsed = showcaseSchema.safeParse( body );
    if ( !parsed.success )
        return NextResponse.json( { error: parsed.error.issues[ 0 ]?.message || 'Homepage content is invalid.' }, { status: 400 } );

    try
    {
        const db = getSupabaseAdmin();
        const { error } = await db.from( 'settings' ).upsert( {
            id: 'store',
            homepage_showcase: parsed.data,
            updated_at: new Date().toISOString(),
        } );
        if ( error )
        {
            if ( missingMigration( error ) )
                return NextResponse.json( { error: 'Run supabase/migrations/0007_homepage_showcase.sql in the Supabase SQL Editor before saving homepage content.' }, { status: 503 } );
            throw error;
        }
        return NextResponse.json( parsed.data );
    } catch ( error )
    {
        console.error( 'Could not save admin homepage content:', error );
        return NextResponse.json( { error: 'Could not save homepage content.' }, { status: 500 } );
    }
}
