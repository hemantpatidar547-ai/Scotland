import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase/db';

const contactMessageSchema = z.object( {
    name: z.string().trim().min( 2 ).max( 100 ),
    phone: z.string().regex( /^[6-9][0-9]{9}$/ ),
    message: z.string().trim().min( 10 ).max( 2000 ),
} );

export async function POST ( request: Request )
{
    const rateLimitResponse = await enforceRateLimit( request, {
        scope: 'contact-message',
        limit: 5,
        windowSeconds: 3600,
    } );
    if ( rateLimitResponse ) return rateLimitResponse;

    let body: unknown;
    try
    {
        body = await request.json();
    } catch
    {
        return NextResponse.json( { error: 'Enter your name, mobile number, and message.' }, { status: 400 } );
    }

    const parsed = contactMessageSchema.safeParse( body );
    if ( !parsed.success )
        return NextResponse.json( { error: 'Enter your name, a valid 10-digit mobile number, and a message of at least 10 characters.' }, { status: 400 } );

    try
    {
        const { error } = await getSupabaseAdmin()
            .from( 'contact_inquiries' )
            .insert( {
                name: parsed.data.name,
                phone: parsed.data.phone,
                message: parsed.data.message,
            } );
        if ( error ) throw error;

        return NextResponse.json( { success: true }, { status: 201 } );
    } catch ( error )
    {
        console.error( 'Contact message submission failed:', error );
        return NextResponse.json( { error: 'Could not save your message. Please try again later.' }, { status: 500 } );
    }
}
