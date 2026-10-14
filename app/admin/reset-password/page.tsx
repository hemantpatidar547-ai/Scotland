'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

export default function AdminResetPasswordPage ()
{
    const [ password, setPassword ] = useState( '' );
    const [ message, setMessage ] = useState( '' );
    const [ error, setError ] = useState( '' );
    const [ pending, setPending ] = useState( false );

    async function updatePassword ( event: FormEvent<HTMLFormElement> )
    {
        event.preventDefault();
        setPending( true );
        setError( '' );
        setMessage( '' );

        try
        {
            const response = await fetch( '/api/account/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { password } ),
            } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not update the password.' );

            setPassword( '' );
            setMessage( 'Password updated. Return to admin sign in and use the new password.' );
        } catch ( cause )
        {
            setError( cause instanceof Error ? cause.message : 'Could not update the password.' );
        } finally
        {
            setPending( false );
        }
    }

    return (
        <main className="shell flex min-h-[75vh] items-center justify-center py-12">
            <section className="w-full max-w-md border border-stone bg-white p-6 shadow-sm sm:p-9">
                <p className="eyebrow text-zinc-500">Protected access</p>
                <h1 className="display mt-2 text-3xl">Set a new admin password</h1>
                <p className="mt-2 text-sm text-zinc-600">Use the secure password reset link sent to the configured admin email.</p>

                <form className="mt-7 space-y-4" onSubmit={ updatePassword }>
                    <label className="block text-sm font-medium text-navy">
                        New password
                        <input
                            className="mt-1 w-full border border-stone px-3 py-2.5"
                            type="password"
                            autoComplete="new-password"
                            minLength={ 8 }
                            maxLength={ 128 }
                            required
                            value={ password }
                            onChange={ event => setPassword( event.target.value ) }
                        />
                    </label>

                    { error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{ error }</p> }
                    { message && <p className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800" role="status">{ message }</p> }

                    <button className="button w-full disabled:cursor-wait disabled:opacity-60" type="submit" disabled={ pending }>
                        { pending ? 'Updating…' : 'Update password' }
                    </button>
                    { message && <a className="block text-center text-sm underline" href="/admin/login">Return to admin sign in</a> }
                </form>
            </section>
        </main>
    );
}
