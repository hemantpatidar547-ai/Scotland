'use client';

import { createClient } from '@/lib/supabase/client';

const IMAGE_BUCKET = 'scotland-product-images';
const IMAGE_UPLOAD_TIMEOUT_MS = 60000;

async function optimizeImage ( file: File ): Promise<File>
{
    if ( file.type.toLowerCase() === 'image/gif' || file.size <= 1024 * 1024 || typeof createImageBitmap !== 'function' )
        return file;

    let bitmap: ImageBitmap;
    try
    {
        bitmap = await createImageBitmap( file );
    } catch
    {
        return file;
    }

    try
    {
        const maxDimension = 1800;
        const scale = Math.min( 1, maxDimension / Math.max( bitmap.width, bitmap.height ) );
        const canvas = document.createElement( 'canvas' );
        canvas.width = Math.max( 1, Math.round( bitmap.width * scale ) );
        canvas.height = Math.max( 1, Math.round( bitmap.height * scale ) );
        const context = canvas.getContext( '2d' );
        if ( !context ) return file;

        context.drawImage( bitmap, 0, 0, canvas.width, canvas.height );
        const optimized = await new Promise<Blob | null>( resolve => canvas.toBlob( resolve, 'image/webp', 0.82 ) );
        if ( !optimized || optimized.type !== 'image/webp' || optimized.size >= file.size ) return file;

        const baseName = file.name.replace( /\.[^.]+$/, '' ) || 'product-image';
        return new File( [ optimized ], `${ baseName }.webp`, { type: 'image/webp', lastModified: file.lastModified } );
    } finally
    {
        bitmap.close();
    }
}

function createTimedFetch (): typeof fetch
{
    return async ( input, init ) =>
    {
        const controller = new AbortController();
        let timedOut = false;
        const timeout = setTimeout( () =>
        {
            timedOut = true;
            controller.abort();
        }, IMAGE_UPLOAD_TIMEOUT_MS );
        const abortFromCaller = () => controller.abort( init?.signal?.reason );
        if ( init?.signal?.aborted ) abortFromCaller();
        else init?.signal?.addEventListener( 'abort', abortFromCaller, { once: true } );

        try
        {
            return await fetch( input, { ...init, signal: controller.signal } );
        } catch ( error )
        {
            if ( timedOut )
                throw new Error( 'Image upload timed out. The image may be too large or the connection is slow; try a smaller image or try again.' );
            throw error;
        } finally
        {
            clearTimeout( timeout );
            init?.signal?.removeEventListener( 'abort', abortFromCaller );
        }
    };
}

export async function uploadAdminImage ( file: File ): Promise<string>
{
    if ( !file.type.toLowerCase().startsWith( 'image/' ) )
        throw new Error( 'Select an image file.' );
    if ( file.type.toLowerCase() === 'image/svg+xml' )
        throw new Error( 'SVG images are not supported. Use a raster image format.' );

    const uploadFile = await optimizeImage( file );
    let response: Response;
    try
    {
        response = await fetch( '/api/admin/product-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( { contentType: uploadFile.type } ),
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
        supabase = createClient( createTimedFetch() );
    } catch ( error )
    {
        throw error instanceof Error ? error : new Error( 'Supabase image storage is not configured.' );
    }

    let uploadError: Error | null = null;
    try
    {
        const uploadResult = await supabase.storage
            .from( IMAGE_BUCKET )
            .uploadToSignedUrl( result.path, result.token, uploadFile, {
                cacheControl: '31536000',
                contentType: uploadFile.type,
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
