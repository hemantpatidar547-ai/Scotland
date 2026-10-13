'use client';

import { useState } from 'react';

export function AccountLogoutButton ()
{
    const [ pending, setPending ] = useState( false );
    const [ error, setError ] = useState<string | null>( null );

    async function logout ()
    {
        setPending( true );
        setError( null );

        try
        {
            // Clear OTP JWT session via API
            await fetch( '/api/auth/logout', { method: 'POST' } );

            // Also try Supabase signout
            try
            {
                const { createClient } = await import( '@/lib/supabase/client' );
                const supabase = createClient();
                await supabase.auth.signOut();
            } catch
            {
                // Supabase may not be available; that's fine.
            }

            window.location.assign( '/' );
        } catch ( err )
        {
            setPending( false );
            console.error( 'Account logout failed:', err );
            setError( 'Could not sign out. Please try again.' );
        }
    }

    return (
        <div className="flex flex-col items-end gap-2">
            { error && <p className="text-xs text-red-700" role="alert">{ error }</p> }
            <button className="button bg-stone text-navy hover:text-white" type="button" onClick={ logout } disabled={ pending }>
                { pending ? 'Signing out…' : 'Log out' }
            </button>
        </div>
    );
}
