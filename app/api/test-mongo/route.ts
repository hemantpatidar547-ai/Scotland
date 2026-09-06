import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET ()
{
    try
    {
        if ( !clientPromise )
        {
            return NextResponse.json( { success: false, message: 'MongoDB is not configured.' }, { status: 503 } );
        }

        const client = await clientPromise;
        const db = client.db( 'scotland' ); // Connects to the 'scotland' database

        // We try to ping the database to ensure connection is actually successful
        await db.command( { ping: 1 } );

        return NextResponse.json( {
            success: true,
            message: 'MongoDB successfully connected! 🚀',
            timestamp: new Date().toISOString()
        } );
    } catch ( error: any )
    {
        console.error( 'MongoDB connection error:', error );
        return NextResponse.json( {
            success: false,
            message: 'Failed to connect to MongoDB ❌',
            error: error.message
        }, { status: 500 } );
    }
}
