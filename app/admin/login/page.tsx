'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

function getAdminRedirect (): string
{
    const requested = new URLSearchParams( window.location.search ).get( 'redirect' );
    return requested && ( requested === '/admin' || requested.startsWith( '/admin/' ) ) && requested !== '/admin/login'
        ? requested
        : '/admin';
}

export default function AdminLoginPage ()
{
    const [ pending, setPending ] = useState( false );
    const [ resetting, setResetting ] = useState( false );
    const [ error, setError ] = useState( '' );
    const [ message, setMessage ] = useState( '' );

    async function handleSubmit ( event: FormEvent<HTMLFormElement> )
    {
        event.preventDefault();
        setPending( true );
        setError( '' );

        const formData = new FormData( event.currentTarget );
        try
        {
            const response = await fetch( '/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( {
                    name: formData.get( 'name' ),
                    mobile: formData.get( 'mobile' ),
                    email: formData.get( 'email' ),
                    password: formData.get( 'password' ),
                } ),
            } );
            const result = await response.json();

            if ( !response.ok ) throw new Error( result.error || 'Admin sign-in failed.' );
            window.location.assign( getAdminRedirect() );
        } catch ( cause )
        {
            setError( cause instanceof Error ? cause.message : 'Could not sign in. Please try again.' );
            setPending( false );
        }
    }

    async function requestPasswordReset ()
    {
        setResetting( true );
        setError( '' );
        setMessage( '' );

        try
        {
            const response = await fetch( '/api/admin/password-reset', { method: 'POST' } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not request a password reset.' );
            setMessage( result.message );
        } catch ( cause )
        {
            setError( cause instanceof Error ? cause.message : 'Could not request a password reset.' );
        } finally
        {
            setResetting( false );
        }
    }

    return (
        <main className="shell flex min-h-[75vh] items-center justify-center py-12">
            <section className="w-full max-w-md border border-stone bg-white p-6 shadow-sm sm:p-9">
                <p className="eyebrow text-zinc-500">Protected access</p>
                <h1 className="display mt-2 text-3xl">Admin sign in</h1>
                <p className="mt-2 text-sm text-zinc-600">Verify your admin details to open the store dashboard.</p>

                <form className="mt-7 space-y-4" onSubmit={ handleSubmit }>
                    <label className="block text-sm font-medium text-navy">
                        Full name
                        <input className="mt-1 w-full border border-stone px-3 py-2.5" name="name" autoComplete="name" required />
                    </label>
                    <label className="block text-sm font-medium text-navy">
                        Mobile number
                        <input className="mt-1 w-full border border-stone px-3 py-2.5" name="mobile" type="tel" autoComplete="tel" required />
                    </label>
                    <label className="block text-sm font-medium text-navy">
                        Admin email or username
                        <input className="mt-1 w-full border border-stone px-3 py-2.5" name="email" type="text" autoComplete="username" autoCapitalize="none" required />
                    </label>
                    <label className="block text-sm font-medium text-navy">
                        Password
                        <input className="mt-1 w-full border border-stone px-3 py-2.5" name="password" type="password" autoComplete="current-password" required />
                    </label>

                    { error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{ error }</p> }
                    { message && <p className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800" role="status">{ message }</p> }

                    <button className="button w-full disabled:cursor-wait disabled:opacity-60" type="submit" disabled={ pending }>
                        { pending ? 'Verifying…' : 'Sign in to dashboard' }
                    </button>
                    <button
                        className="w-full text-sm text-navy underline underline-offset-4 disabled:cursor-wait disabled:opacity-60"
                        type="button"
                        onClick={ requestPasswordReset }
                        disabled={ resetting || pending }
                    >
                        { resetting ? 'Sending reset link…' : 'Forgot password? Email me a reset link' }
                    </button>
                </form>
            </section>
        </main>
    );
}
