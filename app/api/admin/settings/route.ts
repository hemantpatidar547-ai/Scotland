import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { z } from 'zod';
import { DEFAULT_ORDER_PAUSE_MESSAGE } from '@/lib/order-control-shared';

const settingsSchema = z.object( {
    freeDelivery: z.boolean().optional(),
    orderPaused: z.boolean().optional(),
    orderPauseMessage: z.string().trim().min( 1 ).max( 500 ).optional(),
} ).refine( settings => Object.keys( settings ).length > 0, {
    message: 'Choose a setting to update.',
} );

export async function PATCH ( request: Request )
{
    if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    try
    {
        const parsed = settingsSchema.safeParse( await request.json() );
        if ( !parsed.success )
            return NextResponse.json( { error: parsed.error.issues[ 0 ]?.message || 'Invalid settings.' }, { status: 400 } );

        const updates: {
            free_delivery?: boolean;
            order_paused?: boolean;
            order_pause_message?: string;
            updated_at: string;
        } = { updated_at: new Date().toISOString() };
        if ( parsed.data.freeDelivery !== undefined ) updates.free_delivery = parsed.data.freeDelivery;
        if ( parsed.data.orderPaused !== undefined ) updates.order_paused = parsed.data.orderPaused;
        if ( parsed.data.orderPauseMessage !== undefined ) updates.order_pause_message = parsed.data.orderPauseMessage;

        const db = getSupabaseAdmin();
        const { data: settings, error } = await db.from( 'settings' )
            .update( updates )
            .eq( 'id', 'store' )
            .select( 'free_delivery, order_paused, order_pause_message' )
            .maybeSingle();
        if ( error ) throw error;
        if ( !settings ) throw new Error( 'Store settings row is missing. Apply the order control migration.' );

        return NextResponse.json( {
            success: true,
            freeDelivery: settings.free_delivery === true,
            orderPaused: settings.order_paused === true,
            orderPauseMessage: settings.order_pause_message || DEFAULT_ORDER_PAUSE_MESSAGE,
        } );
    } catch ( err )
    {
        console.error( '[Admin Settings] Error:', err );
        if (
            err && typeof err === 'object' &&
            'code' in err &&
            ( err.code === '42703' || err.code === 'PGRST204' )
        )
        {
            return NextResponse.json( {
                error: 'Order Control database setup is incomplete. Apply supabase/migrations/0024_order_control.sql in the Supabase SQL Editor.',
            }, { status: 503 } );
        }
        return NextResponse.json( { error: 'Failed to update settings' }, { status: 500 } );
    }
}
