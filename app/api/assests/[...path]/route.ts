import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET (
    request: Request,
    context: any
)
{
    try
    {
        const { path: routePath } = await context.params as { path: string[] };
        const filePath = path.join( process.cwd(), 'assests', ...routePath );

        if ( !fs.existsSync( filePath ) )
        {
            return new NextResponse( 'File not found', { status: 404 } );
        }

        const fileBuffer = fs.readFileSync( filePath );

        // Determine content type based on extension
        const ext = path.extname( filePath ).toLowerCase();
        let contentType = 'image/jpeg';
        if ( ext === '.png' ) contentType = 'image/png';
        if ( ext === '.gif' ) contentType = 'image/gif';
        if ( ext === '.webp' ) contentType = 'image/webp';

        return new NextResponse( fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        } );
    } catch ( error )
    {
        console.error( 'Error serving asset:', error );
        return new NextResponse( 'Internal Server Error', { status: 500 } );
    }
}
