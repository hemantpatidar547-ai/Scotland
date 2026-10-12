import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/ssr-server';
import { getSupabaseAdmin } from '@/lib/supabase/db';

export const dynamic = 'force-dynamic';

export async function GET ()
{
    try
    {
        const db = getSupabaseAdmin();
        const { data: settings } = await db.from( 'settings' ).select( '*' ).eq( 'id', 'store' ).single();

        const freeDelivery = settings?.free_delivery ?? false;
        return NextResponse.json( {
            freeDelivery,
            deliveryCharge: freeDelivery ? 0 : 50,
        } );
    } catch
    {
        return NextResponse.json( { freeDelivery: false, deliveryCharge: 50 } );
    }
}
