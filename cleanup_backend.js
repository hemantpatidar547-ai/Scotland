const fs = require( "fs" );
const path = require( "path" );

function deleteFolderRecursive ( directoryPath )
{
    if ( fs.existsSync( directoryPath ) ) {
        fs.readdirSync( directoryPath ).forEach( ( file, index ) =>
        {
            const curPath = path.join( directoryPath, file );
            if ( fs.lstatSync( curPath ).isDirectory() ) { // recurse
                deleteFolderRecursive( curPath );
            } else { // delete file
                fs.unlinkSync( curPath );
            }
        } );
        fs.rmdirSync( directoryPath );
        console.log( "Deleted: " + directoryPath );
    }
}

// Folders to remove from frontend
const apiFolder = path.join( __dirname, "app", "api" );
const backendFolder = path.join( __dirname, "backend" );
const backendApiFolder = path.join( __dirname, "backend_api" );
const oldScript = path.join( __dirname, "migrate_backend.js" );

try {
    deleteFolderRecursive( apiFolder );
    deleteFolderRecursive( backendFolder );
    deleteFolderRecursive( backendApiFolder );
    if ( fs.existsSync( oldScript ) ) fs.unlinkSync( oldScript );
    console.log( "All backend code successfully removed from frontend folder!" );
} catch ( err ) {
    console.error( "Error deleting files:", err );
}
