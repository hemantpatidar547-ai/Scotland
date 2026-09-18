'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ProductStatusToggle ( { productId, initialStatus }: { productId: string, initialStatus: string } )
{
    const [ status, setStatus ] = useState( initialStatus );
    const [ isLoading, setIsLoading ] = useState( false );
    const router = useRouter();

    const toggle = async () =>
    {
        setIsLoading( true );
        const newStatus = status === 'published' ? 'draft' : 'published';

        try
        {
            const res = await fetch( `/api/admin/products/${ productId }`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { status: newStatus } )
            } );

            if ( res.ok )
            {
                setStatus( newStatus );
                router.refresh();
            } else
            {
                alert( 'Failed to update status' );
            }
        } catch ( e )
        {
            alert( 'Error updating status' );
        } finally
        {
            setIsLoading( false );
        }
    };

    const isActive = status === 'published' || status === 'active';

    return (
        <button
            onClick={ toggle }
            disabled={ isLoading }
            className={ `relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${ isActive ? 'bg-emerald-600' : 'bg-stone/50' }` }
            title={ isActive ? 'Active' : 'Draft' }
        >
            <span
                className={ `inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${ isActive ? 'translate-x-4.5' : 'translate-x-1' }` }
            />
            { /* Add a text snippet besides it if preferred, but for now just the switch */ }
        </button>
    );
}
