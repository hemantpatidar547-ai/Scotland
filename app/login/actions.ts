'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/ssr-server';

function safeRedirectPath ( value: FormDataEntryValue | null ): string
{
    const path = typeof value === 'string' ? value : '/';
    return path.startsWith( '/' ) && !path.startsWith( '//' ) ? path : '/';
}

async function getPublicOrigin (): Promise<string>
{
    const requestHeaders = await headers();
    const origin = requestHeaders.get( 'origin' );
    if ( origin ) return origin;

    const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
    if ( configuredOrigin ) return configuredOrigin.replace( /\/$/, '' );

    throw new Error( 'Set NEXT_PUBLIC_SITE_URL to enable account verification emails.' );
}

export async function loginAuth ( formData: FormData )
{
    const email = String( formData.get( 'email' ) || '' ).trim().toLowerCase();
    const password = String( formData.get( 'password' ) || '' );
    const redirectTo = safeRedirectPath( formData.get( 'redirect' ) );

    if ( !email || !password ) return { error: 'Email and password are required.' };

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword( { email, password } );
    if ( error )
    {
        if ( error.message.toLowerCase().includes( 'not confirmed' ) )
        {
            return { error: 'Please verify your email using the link we sent before signing in.' };
        }
        return { error: 'Email or password is incorrect.' };
    }

    redirect( redirectTo );
}

export async function signupAuth ( formData: FormData )
{
    const email = String( formData.get( 'email' ) || '' ).trim().toLowerCase();
    const password = String( formData.get( 'password' ) || '' );
    const name = String( formData.get( 'name' ) || '' ).trim();
    const redirectTo = safeRedirectPath( formData.get( 'redirect' ) );

    if ( !name || name.length > 120 ) return { error: 'Enter your name (up to 120 characters).' };
    if ( !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( email ) ) return { error: 'Enter a valid email address.' };
    if ( password.length < 8 ) return { error: 'Password must be at least 8 characters.' };

    const origin = await getPublicOrigin();
    const callback = new URL( '/api/auth/callback', origin );
    callback.searchParams.set( 'redirect', redirectTo );

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp( {
        email,
        password,
        options: {
            emailRedirectTo: callback.toString(),
            data: { full_name: name },
        },
    } );

    if ( error )
    {
        const message = error.message.toLowerCase();
        if ( message.includes( 'already registered' ) || message.includes( 'already exists' ) )
        {
            return { error: 'An account with this email already exists. Please sign in instead.' };
        }
        return { error: 'We could not create your account. Please check your details and try again.' };
    }

    if ( data.session ) redirect( redirectTo );
    return { success: 'Account created. Check your email for a verification link before signing in.' };
}

export async function requestPasswordReset ( formData: FormData )
{
    const email = String( formData.get( 'email' ) || '' ).trim().toLowerCase();
    if ( !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( email ) ) return { error: 'Enter a valid email address.' };

    const origin = await getPublicOrigin();
    const redirectTo = new URL( '/api/auth/callback?redirect=%2Faccount%2Freset-password', origin ).toString();
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail( email, { redirectTo } );

    if ( error )
    {
        console.error( 'Password reset email request failed:', error.message );
        return { error: 'We could not send a reset email right now. Please try again later.' };
    }

    return { success: 'If an account exists for that email, a password reset link has been sent.' };
}
