import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function PATCH ( request: Request, props: { params: Promise<{ id: string }> } )
{
    const params = await props.params;
    if ( !supabaseAdmin ) return NextResponse.json( { error: 'Supabase is not configured' }, { status: 503 } );

    const body = await request.json();
    const { status } = body;

    const dbStatus = status === 'published' ? 'active' : 'draft';

    const { error } = await supabaseAdmin
        .from( 'products' )
        .update( { status: dbStatus } )
        .eq( 'id', params.id );

    if ( error ) return NextResponse.json( { error: error.message }, { status: 400 } );

    return NextResponse.json( { success: true } );
}

export async function DELETE ( request: Request, props: { params: Promise<{ id: string }> } )
{
    const params = await props.params;
    if ( !supabaseAdmin ) return NextResponse.json( { error: 'Supabase is not configured' }, { status: 503 } );

    // Variants and images should ideally be deleted via ON DELETE CASCADE in Supabase.
    // If not, we have to do it manually. Let's do it manually just to be safe.
    await supabaseAdmin.from( 'product_images' ).delete().eq( 'product_id', params.id );
    await supabaseAdmin.from( 'product_variants' ).delete().eq( 'product_id', params.id );

    const { error } = await supabaseAdmin
        .from( 'products' )
        .delete()
        .eq( 'id', params.id );

    if ( error ) return NextResponse.json( { error: error.message }, { status: 400 } );

    return NextResponse.json( { success: true } );
}
