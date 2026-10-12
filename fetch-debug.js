const fs = require( 'fs' );

async function test ()
{
    const res = await fetch( 'http://localhost:3000/api/debug' );
    const json = await res.json();
    fs.writeFileSync( 'debug-out.json', JSON.stringify( json, null, 2 ) );
}
test();
