import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/ssr-server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { enforceRateLimit } from '@/lib/rate-limit';

const returnSchema = z.object( {
    reason: z.string().trim().min( 5 ).max( 500 ),
    itemIndexes: z.array( z.number().int().min( 0 ).max( 99 ) ).min( 1 ).max( 100 )
        .refine( indexes => new Set( indexes ).size === indexes.length, 'A product can only be selected once.' ),
} );

export async function POST (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
)
{
    const auth = await createClient();
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if ( authError || !user )
        return NextResponse.json( { error: 'Please sign in to request a return.' }, { status: 401 } );

    const rateLimitResponse = await enforceRateLimit( request, {
        scope: 'order-return',
        limit: 5,
        windowSeconds: 900,
        subject: user.id,
    } );
    if ( rateLimitResponse ) return rateLimitResponse;

    const { id } = await params;
    if ( !/^[0-9a-f-]{36}$/i.test( id ) )
        return NextResponse.json( { error: 'Invalid order ID.' }, { status: 400 } );

    let body: unknown;
    try
    {
        body = await request.json();
    } catch
    {
        return NextResponse.json( { error: 'Enter a return reason.' }, { status: 400 } );
    }

    const parsed = returnSchema.safeParse( body );
    if ( !parsed.success )
        return NextResponse.json( { error: parsed.error.issues[ 0 ]?.message || 'Enter a return reason.' }, { status: 400 } );

    try
    {
        const db = getSupabaseAdmin();
        const { data, error } = await db.rpc( 'request_customer_return', {
            p_order_id: id,
            p_user_id: user.id,
            p_reason: parsed.data.reason,
            p_item_indexes: parsed.data.itemIndexes,
        } );
        if ( error )
        {
            const message = error.message.toLowerCase();
            if ( message.includes( 'order not found' ) )
                return NextResponse.json( { error: 'Order not found.' }, { status: 404 } );
            if ( message.includes( 'only delivered' ) )
                return NextResponse.json( { error: 'A return can only be requested after the order is marked delivered.' }, { status: 409 } );
            if ( message.includes( '48-hour return window' ) )
                return NextResponse.json( { error: 'The 48-hour return window has expired.' }, { status: 409 } );
            if ( message.includes( 'return request already exists' ) )
                return NextResponse.json( { error: 'A return request already exists for this order.' }, { status: 409 } );
            if ( error.code === 'PGRST202' )
                return NextResponse.json( { error: 'Return setup is incomplete. Apply supabase/migrations/0012_customer_returns.sql in the Supabase SQL Editor.' }, { status: 503 } );
            throw error;
        }

        const result = Array.isArray( data ) ? data[ 0 ] : data;
        return NextResponse.json( {
            success: true,
            returnStatus: result?.return_status,
            refundAmount: Number( result?.return_refund_amount || 0 ),
        } );
    } catch ( error )
    {
        console.error( 'Customer return request failed:', error );
        return NextResponse.json( { error: 'Could not submit your return request. Please try again or contact support.' }, { status: 500 } );
    }
}
