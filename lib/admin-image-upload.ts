'use client';

import { createClient } from '@/lib/supabase/client';

const IMAGE_BUCKET = 'scotland-product-images';

export async function uploadAdminImage ( file: File ): Promise<string>
{
    if ( !file.type.toLowerCase().startsWith( 'image/' ) )
        throw new Error( 'Select an image file.' );
    if ( file.type.toLowerCase() === 'image/svg+xml' )
        throw new Error( 'SVG images are not supported. Use a raster image format.' );

    const response = await fetch( '/api/admin/product-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( { contentType: file.type } ),
    } );
    const result = await response.json().catch( () => ( { error: 'Could not prepare image upload.' } ) );
    if ( !response.ok ) throw new Error( result.error || 'Could not prepare image upload.' );
    if ( typeof result.path !== 'string' || typeof result.token !== 'string' )
        throw new Error( 'Image upload authorization was incomplete. Please try again.' );

    const supabase = createClient();
    const { error } = await supabase.storage
        .from( IMAGE_BUCKET )
        .uploadToSignedUrl( result.path, result.token, file, {
            cacheControl: '31536000',
            contentType: file.type,
            upsert: false,
        } );
    if ( error )
    {
        console.error( 'Direct Supabase image upload failed:', error );
        const message = error.message.toLowerCase();
        if ( message.includes( 'size' ) || message.includes( 'too large' ) || message.includes( 'payload' ) )
            throw new Error( 'Supabase rejected this file because it exceeds your project Storage size limit. Increase that limit in Supabase Dashboard → Storage settings.' );
        throw new Error( `Supabase image upload failed: ${ error.message }` );
    }

    const { data } = supabase.storage.from( IMAGE_BUCKET ).getPublicUrl( result.path );
    let publicUrl: URL;
    try
    {
        publicUrl = new URL( data.publicUrl );
    } catch
    {
        throw new Error( 'Image storage returned an invalid public URL.' );
    }
    if ( publicUrl.protocol !== 'https:' && !( publicUrl.protocol === 'http:' && [ 'localhost', '127.0.0.1' ].includes( publicUrl.hostname ) ) )
        throw new Error( 'Image storage returned an invalid public URL.' );
    return publicUrl.toString();
}
