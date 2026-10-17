import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase/db';

type CategoryPayload = {
    id?: string;
    name?: string;
    slug?: string;
    description?: string;
    seo_title?: string;
    seo_description?: string;
    is_active?: boolean;
};

function normalizeSlug ( value: string ): string
{
    return value.trim().toLowerCase().normalize( 'NFKD' )
        .replace( /[\u0300-\u036f]/g, '' )
        .replace( /[^a-z0-9]+/g, '-' )
        .replace( /(^-|-$)/g, '' );
}

function validatePayload ( payload: CategoryPayload ): string | null
{
    if ( !payload.name?.trim() ) return 'Category name is required.';
    if ( payload.name.trim().length > 100 ) return 'Category name must be 100 characters or fewer.';
    if ( ( payload.description || '' ).length > 3000 ) return 'Category content must be 3,000 characters or fewer.';
    if ( ( payload.seo_title || '' ).length > 70 ) return 'SEO title must be 70 characters or fewer.';
    if ( ( payload.seo_description || '' ).length > 160 ) return 'SEO description must be 160 characters or fewer.';
    return null;
}

export async function GET ()
{
    if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
    const db = getSupabaseAdmin();
    const { data, error } = await db.from( 'categories' )
        .select( 'id, name, slug, description, seo_title, seo_description, is_active, updated_at' )
        .order( 'name' );
    if ( error )
    {
        console.error( 'Admin category list failed:', error.message );
        return NextResponse.json( { error: 'Could not load categories.' }, { status: 500 } );
    }
    return NextResponse.json( { data: data || [] } );
}

export async function POST ( request: NextRequest )
{
    if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
    const payload = await request.json() as CategoryPayload;
    const validationError = validatePayload( payload );
    if ( validationError ) return NextResponse.json( { error: validationError }, { status: 400 } );

    const slug = normalizeSlug( payload.slug || payload.name || '' );
    if ( !slug ) return NextResponse.json( { error: 'Enter a valid URL slug.' }, { status: 400 } );
    const db = getSupabaseAdmin();
    const { data, error } = await db.from( 'categories' ).insert( {
        name: payload.name!.trim(),
        slug,
        description: payload.description?.trim() || null,
        seo_title: payload.seo_title?.trim() || null,
        seo_description: payload.seo_description?.trim() || null,
        is_active: payload.is_active !== false,
    } ).select( 'id, name, slug, description, seo_title, seo_description, is_active, updated_at' ).single();
    if ( error )
    {
        const conflict = error.code === '23505';
        return NextResponse.json( { error: conflict ? 'That category URL already exists.' : 'Could not create the category.' }, { status: conflict ? 409 : 500 } );
    }
    return NextResponse.json( { data }, { status: 201 } );
}

export async function PATCH ( request: NextRequest )
{
    if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
    const payload = await request.json() as CategoryPayload;
    if ( !payload.id ) return NextResponse.json( { error: 'Category ID is required.' }, { status: 400 } );
    const validationError = validatePayload( payload );
    if ( validationError ) return NextResponse.json( { error: validationError }, { status: 400 } );

    const slug = normalizeSlug( payload.slug || payload.name || '' );
    if ( !slug ) return NextResponse.json( { error: 'Enter a valid URL slug.' }, { status: 400 } );
    const db = getSupabaseAdmin();
    const { data, error } = await db.from( 'categories' ).update( {
        name: payload.name!.trim(),
        slug,
        description: payload.description?.trim() || null,
        seo_title: payload.seo_title?.trim() || null,
        seo_description: payload.seo_description?.trim() || null,
        is_active: payload.is_active !== false,
        updated_at: new Date().toISOString(),
    } ).eq( 'id', payload.id )
        .select( 'id, name, slug, description, seo_title, seo_description, is_active, updated_at' )
        .maybeSingle();
    if ( error )
    {
        const conflict = error.code === '23505';
        return NextResponse.json( { error: conflict ? 'That category URL already exists.' : 'Could not update the category.' }, { status: conflict ? 409 : 500 } );
    }
    if ( !data ) return NextResponse.json( { error: 'Category not found.' }, { status: 404 } );
    return NextResponse.json( { data } );
}
