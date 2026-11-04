'use client';

import { createClient } from '@/lib/supabase/client';

const IMAGE_BUCKET = 'scotland-product-images';

export async function uploadAdminImage ( file: File ): Promise<string>
{
    if ( !file.type.toLowerCase().startsWith( 'image/' ) )
        throw new Error( 'Select an image file.' );
    if ( file.type.toLowerCase() === 'image/svg+xml' )
        throw new Error( 'SVG images are not supported. Use a raster image format.' );

    let response: Response;
    try
    {
        response = await fetch( '/api/admin/product-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( { contentType: file.type } ),
            signal: AbortSignal.timeout( 30000 ),
        } );
    } catch ( error )
    {
        if ( error instanceof DOMException && error.name === 'TimeoutError' )
            throw new Error( 'Preparing the image upload timed out. Check your connection and try again.' );
        throw new Error( 'Could not reach the image upload service. Check your connection and try again.' );
    }
    const result = await response.json().catch( () => ( { error: 'Could not prepare image upload.' } ) );
    if ( !response.ok ) throw new Error( result.error || 'Could not prepare image upload.' );
    if ( typeof result.path !== 'string' || typeof result.token !== 'string' )
        throw new Error( 'Image upload authorization was incomplete. Please try again.' );

    let supabase: ReturnType<typeof createClient>;
    try
    {
        supabase = createClient();
    } catch ( error )
    {
        throw error instanceof Error ? error : new Error( 'Supabase image storage is not configured.' );
    }

    let uploadError: Error | null = null;
    try
    {
        const uploadResult = await supabase.storage
            .from( IMAGE_BUCKET )
            .uploadToSignedUrl( result.path, result.token, file, {
                cacheControl: '31536000',
                contentType: file.type,
                upsert: false,
            } );
        uploadError = uploadResult.error;
    } catch ( error )
    {
        console.error( 'Could not reach Supabase Storage for the product image:', error );
        throw new Error(
            error instanceof Error
                ? `Could not upload the image to Supabase Storage: ${ error.message }`
                : 'Could not reach Supabase Storage. Check your connection and project settings.'
        );
    }
    if ( uploadError )
    {
        console.error( 'Direct Supabase image upload failed:', uploadError );
        const message = uploadError.message.toLowerCase();
        if ( message.includes( 'size' ) || message.includes( 'too large' ) || message.includes( 'payload' ) )
            throw new Error( 'Supabase rejected this file because it exceeds your project Storage size limit. Increase that limit in Supabase Dashboard → Storage settings.' );
        throw new Error( `Supabase image upload failed: ${ uploadError.message }` );
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
