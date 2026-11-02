import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase/db';

const PAGE_SIZE = 25;

export async function GET ( request: NextRequest )
{
    try
    {
        if ( !await isAdminRequest() )
            return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const requestedPage = Number.parseInt( request.nextUrl.searchParams.get( 'page' ) || '1', 10 );
        const page = Number.isSafeInteger( requestedPage ) && requestedPage > 0
            ? Math.min( requestedPage, 100000 )
            : 1;
        const start = ( page - 1 ) * PAGE_SIZE;
        const { data, count, error } = await getSupabaseAdmin()
            .from( 'contact_inquiries' )
            .select( 'id, name, phone, message, created_at', { count: 'exact' } )
            .order( 'created_at', { ascending: false } )
            .range( start, start + PAGE_SIZE - 1 );
        if ( error ) throw error;

        return NextResponse.json( {
            data: data || [],
            pagination: {
                page,
                pageSize: PAGE_SIZE,
                total: count || 0,
                totalPages: Math.max( 1, Math.ceil( ( count || 0 ) / PAGE_SIZE ) ),
            },
        } );
    } catch ( error )
    {
        console.error( 'Admin contact messages fetch failed:', error );
        return NextResponse.json( { error: 'Could not load contact messages.' }, { status: 500 } );
    }
}
