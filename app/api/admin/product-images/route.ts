import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase/server';

const IMAGE_BUCKET = 'scotland-product-images';
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const IMAGE_FORMATS: Record<string, { extension: string; signature: ( bytes: Uint8Array ) => boolean }> = {
    'image/jpeg': { extension: 'jpg', signature: bytes => bytes[ 0 ] === 0xff && bytes[ 1 ] === 0xd8 && bytes[ 2 ] === 0xff },
    'image/png': { extension: 'png', signature: bytes => bytes.length >= 8 && bytes[ 0 ] === 0x89 && bytes[ 1 ] === 0x50 && bytes[ 2 ] === 0x4e && bytes[ 3 ] === 0x47 && bytes[ 4 ] === 0x0d && bytes[ 5 ] === 0x0a && bytes[ 6 ] === 0x1a && bytes[ 7 ] === 0x0a },
    'image/webp': { extension: 'webp', signature: bytes => bytes.length >= 12 && String.fromCharCode( ...bytes.slice( 0, 4 ) ) === 'RIFF' && String.fromCharCode( ...bytes.slice( 8, 12 ) ) === 'WEBP' },
    'image/avif': { extension: 'avif', signature: bytes => bytes.length >= 12 && String.fromCharCode( ...bytes.slice( 4, 8 ) ) === 'ftyp' && [ 'avif', 'avis' ].includes( String.fromCharCode( ...bytes.slice( 8, 12 ) ) ) },
    'image/gif': { extension: 'gif', signature: bytes => [ 'GIF87a', 'GIF89a' ].includes( String.fromCharCode( ...bytes.slice( 0, 6 ) ) ) },
};

export async function POST ( request: Request )
{
    if ( !await isAdminRequest() )
        return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    if ( !supabaseAdmin )
        return NextResponse.json( { error: 'Supabase is not configured.' }, { status: 503 } );

    let formData: FormData;
    try
    {
        formData = await request.formData();
    } catch ( error )
    {
        console.error( 'Could not read product image upload form data:', error );
        return NextResponse.json( { error: 'Could not read the selected image.' }, { status: 400 } );
    }

    const file = formData.get( 'file' );
    if ( !( file instanceof File ) )
        return NextResponse.json( { error: 'Select an image file to upload.' }, { status: 400 } );
    if ( file.size === 0 || file.size > MAX_IMAGE_SIZE )
        return NextResponse.json( { error: 'Image files must be between 1 byte and 4 MB.' }, { status: 400 } );

    const format = IMAGE_FORMATS[ file.type.toLowerCase() ];
    if ( !format )
        return NextResponse.json( { error: 'Use a JPEG, PNG, WebP, AVIF, or GIF image.' }, { status: 400 } );

    const bytes = new Uint8Array( await file.arrayBuffer() );
    if ( !format.signature( bytes ) )
        return NextResponse.json( { error: 'The selected file contents do not match its image type.' }, { status: 400 } );

    const path = `products/${ randomUUID() }.${ format.extension }`;
    const { error } = await supabaseAdmin.storage
        .from( IMAGE_BUCKET )
        .upload( path, bytes, {
            cacheControl: '31536000',
            contentType: file.type.toLowerCase(),
            upsert: false,
        } );
    if ( error )
    {
        console.error( 'Supabase product image upload failed:', error );
        return NextResponse.json(
            { error: 'Image upload failed. In the Supabase project used by this website, apply supabase/migrations/0006_product_image_storage.sql to create the image bucket, then try again.' },
            { status: 503 }
        );
    }

    const { data } = supabaseAdmin.storage.from( IMAGE_BUCKET ).getPublicUrl( path );
    return NextResponse.json( { url: data.publicUrl }, { status: 201 } );
}
