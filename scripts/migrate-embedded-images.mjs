import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig( process.cwd() );

const BUCKET = 'scotland-product-images';
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const APPLY = process.argv.includes( '--apply' );
const FORMATS = {
    'image/jpeg': { extension: 'jpg', matches: bytes => bytes[ 0 ] === 0xff && bytes[ 1 ] === 0xd8 && bytes[ 2 ] === 0xff },
    'image/png': { extension: 'png', matches: bytes => bytes.length >= 8 && bytes.subarray( 0, 8 ).equals( Buffer.from( [ 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a ] ) ) },
    'image/webp': { extension: 'webp', matches: bytes => bytes.length >= 12 && bytes.toString( 'ascii', 0, 4 ) === 'RIFF' && bytes.toString( 'ascii', 8, 12 ) === 'WEBP' },
    'image/avif': { extension: 'avif', matches: bytes => bytes.length >= 12 && bytes.toString( 'ascii', 4, 8 ) === 'ftyp' && [ 'avif', 'avis' ].includes( bytes.toString( 'ascii', 8, 12 ) ) },
    'image/gif': { extension: 'gif', matches: bytes => [ 'GIF87a', 'GIF89a' ].includes( bytes.toString( 'ascii', 0, 6 ) ) },
};

function requireConfiguration ()
{
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if ( !url || !key )
        throw new Error( 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment or .env.local.' );
    return createClient( url, key, { auth: { persistSession: false } } );
}

function parseImageDataUri ( value, record )
{
    const match = /^data:(image\/(?:jpeg|png|webp|avif|gif));base64,([A-Za-z0-9+/=\r\n]+)$/i.exec( value );
    if ( !match ) throw new Error( `Unsupported embedded image format in ${ record }.` );

    const mimeType = match[ 1 ].toLowerCase();
    const bytes = Buffer.from( match[ 2 ], 'base64' );
    const format = FORMATS[ mimeType ];
    if ( bytes.length === 0 || bytes.length > MAX_IMAGE_SIZE )
        throw new Error( `Image in ${ record } is empty or larger than 8 MB.` );
    if ( !format.matches( bytes ) )
        throw new Error( `Image contents in ${ record } do not match ${ mimeType }.` );

    return { bytes, mimeType, extension: format.extension };
}

async function migrateImageColumn ( supabase, table, column )
{
    let lastId = '';
    let migrated = 0;
    while ( true )
    {
        let query = supabase.from( table )
            .select( `id, ${ column }` )
            .like( column, 'data:image/%' )
            .order( 'id' )
            .limit( 100 );
        if ( lastId ) query = query.gt( 'id', lastId );

        const { data, error } = await query;
        if ( error ) throw new Error( `Could not scan ${ table }.${ column }: ${ error.message }` );
        if ( !data?.length ) break;

        for ( const row of data )
        {
            lastId = String( row.id );
            const record = `${ table }/${ lastId }`;
            const image = parseImageDataUri( row[ column ], record );
            const path = `legacy/${ table }/${ lastId }.${ image.extension }`;
            if ( APPLY )
            {
                const { error: uploadError } = await supabase.storage.from( BUCKET ).upload( path, image.bytes, {
                    cacheControl: '31536000',
                    contentType: image.mimeType,
                    upsert: true,
                } );
                if ( uploadError ) throw new Error( `Could not upload ${ record }: ${ uploadError.message }` );

                const { data: publicData } = supabase.storage.from( BUCKET ).getPublicUrl( path );
                const { error: updateError } = await supabase.from( table )
                    .update( { [ column ]: publicData.publicUrl } )
                    .eq( 'id', row.id );
                if ( updateError ) throw new Error( `Could not update ${ record }: ${ updateError.message }` );
            }
            migrated += 1;
        }
    }
    return migrated;
}

async function migrateSizeChartImages ( supabase )
{
    let lastId = '';
    let migrated = 0;
    while ( true )
    {
        let query = supabase.from( 'products' )
            .select( 'id, product_metadata' )
            .order( 'id' )
            .limit( 100 );
        if ( lastId ) query = query.gt( 'id', lastId );

        const { data, error } = await query;
        if ( error ) throw new Error( `Could not scan product size charts: ${ error.message }` );
        if ( !data?.length ) break;

        for ( const row of data )
        {
            lastId = String( row.id );
            const metadata = row.product_metadata || {};
            const sizeChart = metadata.size_chart;
            if ( typeof sizeChart !== 'string' || !sizeChart.startsWith( 'data:image/' ) ) continue;

            const record = `products/${ lastId } size_chart`;
            const image = parseImageDataUri( sizeChart, record );
            const path = `legacy/products/${ lastId }-size-chart.${ image.extension }`;
            if ( APPLY )
            {
                const { error: uploadError } = await supabase.storage.from( BUCKET ).upload( path, image.bytes, {
                    cacheControl: '31536000',
                    contentType: image.mimeType,
                    upsert: true,
                } );
                if ( uploadError ) throw new Error( `Could not upload ${ record }: ${ uploadError.message }` );

                const { data: publicData } = supabase.storage.from( BUCKET ).getPublicUrl( path );
                const { error: updateError } = await supabase.from( 'products' )
                    .update( { product_metadata: { ...metadata, size_chart: publicData.publicUrl } } )
                    .eq( 'id', row.id );
                if ( updateError ) throw new Error( `Could not update ${ record }: ${ updateError.message }` );
            }
            migrated += 1;
        }
    }
    return migrated;
}

async function main ()
{
    const supabase = requireConfiguration();
    const results = [];
    for ( const [ table, column ] of [
        [ 'product_images', 'image_url' ],
        [ 'product_variants', 'image_url' ],
        [ 'categories', 'image_url' ],
    ] )
    {
        results.push( [ `${ table }.${ column }`, await migrateImageColumn( supabase, table, column ) ] );
    }
    results.push( [ 'products.product_metadata.size_chart', await migrateSizeChartImages( supabase ) ] );

    for ( const [ field, count ] of results )
        console.log( `${ APPLY ? 'Converted' : 'Would convert'} ${ count } embedded image(s) in ${ field }.` );
    if ( !APPLY ) console.log( 'Dry run only. Review the counts, apply migration 0006, then rerun with --apply to update image references.' );
}

main().catch( error =>
{
    console.error( 'Embedded image migration failed:', error );
    process.exitCode = 1;
} );
