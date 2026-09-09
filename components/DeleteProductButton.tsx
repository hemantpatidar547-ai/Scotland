'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeleteProductButton ( { productId }: { productId: string } )
{
    const [ loading, setLoading ] = useState( false );
    const router = useRouter();

    const remove = async () =>
    {
        if ( !window.confirm( 'Delete this product permanently? It will be removed from the catalog, carts, and wishlist.' ) ) return;

        setLoading( true );
        try
        {
            const response = await fetch( `/api/admin/products/${ productId }`, { method: 'DELETE' } );
            if ( !response.ok )
            {
                const result = await response.json();
                throw new Error( result.error || 'Product could not be deleted.' );
            }

            router.refresh();
        } catch ( error )
        {
            window.alert( error instanceof Error ? error.message : 'Product could not be deleted.' );
            setLoading( false );
        }
    };

    return <button type="button" className="text-xs text-red-700 underline disabled:opacity-50" onClick={ remove } disabled={ loading }>{ loading ? 'Deleting...' : 'Delete' }</button>;
}