const url = 'http://localhost:3000/api/admin/settings';

async function testFetch ()
{
    try {
        console.log( 'Sending PATCH to', url );
        const res = await fetch( url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( { freeDelivery: true } )
        } );
        const data = await res.text();
        console.log( 'Response:', res.status, data );
    } catch ( e ) {
        console.error( e );
    }
}

testFetch();
