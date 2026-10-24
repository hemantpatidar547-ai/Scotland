import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase/server';

const IMAGE_BUCKET = 'scotland-product-images';
const uploadSchema = z.object( {
    contentType: z.string().trim().min( 1 ).max( 100 )
        .refine( type => type.toLowerCase().startsWith( 'image/' ), 'Select an image file.' )
        .refine( type => type.toLowerCase() !== 'image/svg+xml', 'SVG images are not supported. Use a raster image format.' ),
} );

export async function POST ( request: Request )
{
    if ( !await isAdminRequest() )
        return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    if ( !supabaseAdmin )
        return NextResponse.json( { error: 'Supabase is not configured.' }, { status: 503 } );

    let body: unknown;
    try
    {
        body = await request.json();
    } catch
    {
        return NextResponse.json( { error: 'Send a valid image upload request.' }, { status: 400 } );
    }

    const parsed = uploadSchema.safeParse( body );
    if ( !parsed.success )
        return NextResponse.json( { error: parsed.error.issues[ 0 ]?.message || 'Select an image file.' }, { status: 400 } );

    const extension = parsed.data.contentType.toLowerCase().split( '/' )[ 1 ]?.replace( /[^a-z0-9.+-]/g, '' ) || 'img';
    const path = `products/${ randomUUID() }.${ extension.slice( 0, 12 ) }`;
    const { data, error } = await supabaseAdmin.storage
        .from( IMAGE_BUCKET )
        .createSignedUploadUrl( path, { upsert: false } );
    if ( error )
    {
        console.error( 'Could not create signed product image upload URL:', error );
        const providerMessage = error.message.toLowerCase();
        if ( providerMessage.includes( 'bucket not found' ) || providerMessage.includes( 'no such bucket' ) )
            return NextResponse.json(
                { error: 'The image bucket is missing. Run supabase/migrations/0010_unlimited_product_image_bucket.sql in the Supabase project connected to this website, then try again.' },
                { status: 503 }
            );
        return NextResponse.json(
            { error: `Could not prepare image upload (${ error.message }). Check that the website uses the intended Supabase project and that SUPABASE_SERVICE_ROLE_KEY is valid.` },
            { status: 503 }
        );
    }

    return NextResponse.json( { path: data.path, token: data.token }, { status: 201 } );
}
