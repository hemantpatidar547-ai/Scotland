'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function PasswordUpdateForm ( { returnTo = '/account?passwordUpdated=1' }: { returnTo?: string } )
{
    const router = useRouter();
    const [ password, setPassword ] = useState( '' );
    const [ message, setMessage ] = useState( '' );
    const [ saving, setSaving ] = useState( false );

    async function submit ( event: FormEvent<HTMLFormElement> )
    {
        event.preventDefault();
        setSaving( true );
        setMessage( '' );
        try
        {
            const response = await fetch( '/api/account/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { password } ),
            } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not update your password.' );
            setPassword( '' );
            setMessage( 'Your password has been updated.' );
            router.replace( returnTo );
        } catch ( error )
        {
            setMessage( error instanceof Error ? error.message : 'Could not update your password.' );
        } finally
        {
            setSaving( false );
        }
    }

    return (
        <form onSubmit={ submit } className="mt-5 space-y-4">
            <label className="block text-sm font-medium" htmlFor="new-password">New password
                <input className="input mt-2" id="new-password" name="password" type="password" minLength={ 8 } maxLength={ 128 } autoComplete="new-password" required value={ password } onChange={ event => setPassword( event.target.value ) } />
            </label>
            { message && <p className="text-sm text-navy" role="status">{ message }</p> }
            <button className="button" disabled={ saving }>{ saving ? 'Updating…' : 'Update password' }</button>
        </form>
    );
}
