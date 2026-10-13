import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedCustomer } from '@/lib/customer-auth';

const addressPayload = z.object( {
    label: z.string().trim().min(1).max(40).default( 'Home' ),
    recipient_name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(7).max(30),
    address_line: z.string().trim().min(4).max(300),
    city: z.string().trim().min(1).max(100),
    postal_code: z.string().trim().min(3).max(20),
    country: z.string().trim().min(1).max(80).default( 'India' ),
    is_default: z.boolean().default( false ),
} );

export async function GET ()
{
    const { user, db } = await getAuthenticatedCustomer();
    if ( !user || !db ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    const { data, error } = await db.from( 'customer_addresses' )
        .select( 'id, label, recipient_name, phone, address_line, city, postal_code, country, is_default, created_at' )
        .eq( 'user_id', user.id )
        .order( 'is_default', { ascending: false } )
        .order( 'created_at', { ascending: false } );
    if ( error )
    {
        console.error( 'Customer addresses fetch failed:', error );
        return NextResponse.json( { error: 'Could not load saved addresses.' }, { status: 500 } );
    }

    return NextResponse.json( { data: data || [] } );
}

export async function POST ( request: NextRequest )
{
    const origin = request.headers.get( 'origin' );
    if ( origin && origin !== request.nextUrl.origin ) return NextResponse.json( { error: 'Invalid request origin.' }, { status: 403 } );

    const { user, db } = await getAuthenticatedCustomer();
    if ( !user || !db ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
    const payload = addressPayload.safeParse( await request.json() );
    if ( !payload.success ) return NextResponse.json( { error: 'Please complete all address fields correctly.' }, { status: 400 } );

    if ( payload.data.is_default )
    {
        const { error } = await db.from( 'customer_addresses' )
            .update( { is_default: false } ).eq( 'user_id', user.id );
        if ( error )
        {
            console.error( 'Customer default address reset failed:', error );
            return NextResponse.json( { error: 'Could not save the default address.' }, { status: 500 } );
        }
    }

    const { data, error } = await db.from( 'customer_addresses' )
        .insert( { ...payload.data, user_id: user.id } )
        .select( 'id, label, recipient_name, phone, address_line, city, postal_code, country, is_default, created_at' )
        .single();
    if ( error )
    {
        console.error( 'Customer address creation failed:', error );
        return NextResponse.json( { error: 'Could not save this address.' }, { status: 500 } );
    }

    return NextResponse.json( { data }, { status: 201 } );
}

export async function PATCH ( request: NextRequest )
{
    const origin = request.headers.get( 'origin' );
    if ( origin && origin !== request.nextUrl.origin ) return NextResponse.json( { error: 'Invalid request origin.' }, { status: 403 } );

    const { user, db } = await getAuthenticatedCustomer();
    if ( !user || !db ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    const body = await request.json();
    const id = z.string().uuid().safeParse( body.id );
    const payload = addressPayload.partial().safeParse( body.address );
    if ( !id.success || !payload.success || !Object.keys( payload.data ).length )
    {
        return NextResponse.json( { error: 'Invalid address update.' }, { status: 400 } );
    }

    const { data: existingAddress, error: findError } = await db.from( 'customer_addresses' )
        .select( 'id' )
        .eq( 'id', id.data )
        .eq( 'user_id', user.id )
        .maybeSingle();
    if ( findError )
    {
        console.error( 'Customer address lookup failed:', findError );
        return NextResponse.json( { error: 'Could not find this address.' }, { status: 500 } );
    }
    if ( !existingAddress ) return NextResponse.json( { error: 'Address not found.' }, { status: 404 } );

    if ( payload.data.is_default )
    {
        const { error } = await db.from( 'customer_addresses' )
            .update( { is_default: false } ).eq( 'user_id', user.id );
        if ( error )
        {
            console.error( 'Customer default address update failed:', error );
            return NextResponse.json( { error: 'Could not update the default address.' }, { status: 500 } );
        }
    }

    const { data, error } = await db.from( 'customer_addresses' )
        .update( { ...payload.data, updated_at: new Date().toISOString() } )
        .eq( 'id', id.data )
        .eq( 'user_id', user.id )
        .select( 'id, label, recipient_name, phone, address_line, city, postal_code, country, is_default, created_at' )
        .maybeSingle();
    if ( error )
    {
        console.error( 'Customer address update failed:', error );
        return NextResponse.json( { error: 'Could not update this address.' }, { status: 500 } );
    }
    if ( !data ) return NextResponse.json( { error: 'Address not found.' }, { status: 404 } );

    return NextResponse.json( { data } );
}

export async function DELETE ( request: NextRequest )
{
    const origin = request.headers.get( 'origin' );
    if ( origin && origin !== request.nextUrl.origin ) return NextResponse.json( { error: 'Invalid request origin.' }, { status: 403 } );

    const { user, db } = await getAuthenticatedCustomer();
    if ( !user || !db ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
    const id = z.string().uuid().safeParse( new URL( request.url ).searchParams.get( 'id' ) );
    if ( !id.success ) return NextResponse.json( { error: 'Invalid address id.' }, { status: 400 } );

    const { data, error } = await db.from( 'customer_addresses' )
        .delete().eq( 'id', id.data ).eq( 'user_id', user.id )
        .select( 'id' ).maybeSingle();
    if ( error )
    {
        console.error( 'Customer address delete failed:', error );
        return NextResponse.json( { error: 'Could not delete this address.' }, { status: 500 } );
    }
    if ( !data ) return NextResponse.json( { error: 'Address not found.' }, { status: 404 } );

    return NextResponse.json( { success: true } );
}
