import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { DEFAULT_ORDER_PAUSE_MESSAGE } from '@/lib/order-control-shared';

export const dynamic = 'force-dynamic';

export async function GET ()
{
    try
    {
        const db = getSupabaseAdmin();
        const { data: settings, error } = await db.from( 'settings' )
            .select( 'free_delivery, order_paused, order_pause_message' )
            .eq( 'id', 'store' )
            .maybeSingle();
        if ( error ) throw error;

        return NextResponse.json( {
            freeDelivery: settings?.free_delivery === true,
            orderPaused: settings?.order_paused === true,
            orderPauseMessage: settings?.order_pause_message || DEFAULT_ORDER_PAUSE_MESSAGE,
        }, { headers: { 'Cache-Control': 'no-store, max-age=0' } } );
    } catch ( error )
    {
        console.error( 'Store settings GET failed:', error );
        return NextResponse.json(
            { error: 'Store settings are temporarily unavailable. Please try again.' },
            { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
    }
}
