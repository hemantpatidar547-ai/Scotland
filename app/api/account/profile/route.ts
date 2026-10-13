import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedCustomer } from '@/lib/customer-auth';

const profilePayload = z.object( {
    full_name: z.string().trim().min(1).max(120),
    phone: z.string().trim().max(30).optional().default( ''),
} );

export async function GET ()
{
    const { user, db } = await getAuthenticatedCustomer();
    if ( !user || !db ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    const { data, error } = await db.from( 'profiles' )
        .select( 'id, email, full_name, phone, created_at' )
        .eq( 'id', user.id )
        .maybeSingle();
    if ( error )
    {
        console.error( 'Customer profile fetch failed:', error );
        return NextResponse.json( { error: 'Could not load your profile.' }, { status: 500 } );
    }

    return NextResponse.json( { data: data || { id: user.id, email: user.email, full_name: '', phone: '' } } );
}

export async function PUT ( request: NextRequest )
{
    const origin = request.headers.get( 'origin' );
    if ( origin && origin !== request.nextUrl.origin ) return NextResponse.json( { error: 'Invalid request origin.' }, { status: 403 } );

    const { user, db } = await getAuthenticatedCustomer();
    if ( !user || !db ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    const payload = profilePayload.safeParse( await request.json() );
    if ( !payload.success ) return NextResponse.json( { error: 'Enter a valid name and phone number.' }, { status: 400 } );

    const { data, error } = await db.from( 'profiles' )
        .upsert( { id: user.id, email: user.email, ...payload.data, updated_at: new Date().toISOString() } )
        .select( 'id, email, full_name, phone, created_at' )
        .single();
    if ( error )
    {
        console.error( 'Customer profile update failed:', error );
        return NextResponse.json( { error: 'Could not save your profile.' }, { status: 500 } );
    }

    return NextResponse.json( { data } );
}
