import { NextResponse } from 'next/server';
import { deleteProduct } from '@/backend/products/delete-product';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function DELETE ( _: Request, { params }: { params: Promise<{ id: string }> } )
{
    try
    {
        if ( !supabaseAdmin ) return NextResponse.json( { error: 'Supabase is not configured.' }, { status: 503 } );

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if ( !user ) return NextResponse.json( { error: 'You must be signed in as an administrator.' }, { status: 401 } );

        const { data: profile } = await supabaseAdmin.from( 'profiles' ).select( 'role' ).eq( 'id', user.id ).maybeSingle();
        if ( profile?.role !== 'admin' && profile?.role !== 'super_admin' )
        {
            return NextResponse.json( { error: 'Administrator access is required.' }, { status: 403 } );
        }

        const { id } = await params;
        const result = await deleteProduct( id );

        return result.data
            ? NextResponse.json( result )
            : NextResponse.json( { error: result.error }, { status: result.status } );
    } catch ( error: any )
    {
        console.error( 'Supabase product delete error:', error );
        return NextResponse.json( { error: error.message || 'Product could not be deleted.' }, { status: 500 } );
    }
}