'use client';

import { useState } from 'react';

export function AdminLogoutButton ()
{
    const [ pending, setPending ] = useState( false );
    const [ error, setError ] = useState( '' );

    async function logout ()
    {
        setPending( true );
        setError( '' );

        try
        {
            const response = await fetch( '/api/admin/logout', { method: 'POST' } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not sign out.' );
            window.location.assign( '/admin/login' );
        } catch ( cause )
        {
            console.error( 'Admin logout failed:', cause );
            setError( cause instanceof Error ? cause.message : 'Could not sign out. Please try again.' );
            setPending( false );
        }
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                className="underline decoration-stone/50 underline-offset-4 transition hover:text-gold disabled:cursor-wait disabled:opacity-60"
                type="button"
                onClick={ logout }
                disabled={ pending }
            >
                { pending ? 'Signing out…' : 'Sign out' }
            </button>
            { error && <span className="text-xs text-red-300" role="alert">{ error }</span> }
        </div>
    );
}
