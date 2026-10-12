import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/db';

export async function PATCH ( request: Request )
{
    try
    {
        const body = await request.json();
        const freeDelivery = body.freeDelivery === true;

        const db = getSupabaseAdmin();
        const { error } = await db.from( 'settings' ).upsert( {
            id: 'store',
            free_delivery: freeDelivery,
            updated_at: new Date().toISOString(),
        } );

        if ( error ) throw error;

        return NextResponse.json( { success: true, freeDelivery } );
    } catch ( err )
    {
        console.error( '[Admin Settings] Error:', err );
        return NextResponse.json( { error: 'Failed to update settings' }, { status: 500 } );
    }
}
