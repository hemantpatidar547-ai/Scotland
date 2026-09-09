'use client';

import { Suspense, useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { loginAuth, signupAuth } from './actions';

function LoginContent ()
{
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get( 'redirect' ) || '/';

    const [ error, setError ] = useState<string | null>( null );
    const [ isPending, startTransition ] = useTransition();
    const [ isLoginMode, setIsLoginMode ] = useState<boolean>( true );

    function handleSubmit ( formData: FormData )
    {
        setError( null );
        startTransition( async () =>
        {
            const action = isLoginMode ? loginAuth : signupAuth;
            const res = await action( formData );
            if ( res?.error )
            {
                setError( res.error );
            }
        } );
    }

    return (
        <div className="w-full max-w-md mx-auto overflow-hidden bg-white/80 backdrop-blur-xl border border-stone/50 shadow-2xl rounded-2xl">
            <div className="p-8 sm:p-10">
                <div className="flex justify-center mb-6">
                    <div className="inline-flex bg-[#f2eee7] rounded-lg p-1">
                        <button
                            onClick={ () => { setIsLoginMode( true ); setError( null ); } }
                            type="button"
                            className={ `px-6 py-2 text-sm font-semibold rounded-md transition-all ${ isLoginMode ? 'bg-white shadow-sm text-navy' : 'text-zinc-500 hover:text-navy' }` }
                        >
                            Sign In
                        </button>
                        <button
                            onClick={ () => { setIsLoginMode( false ); setError( null ); } }
                            type="button"
                            className={ `px-6 py-2 text-sm font-semibold rounded-md transition-all ${ !isLoginMode ? 'bg-white shadow-sm text-navy' : 'text-zinc-500 hover:text-navy' }` }
                        >
                            Create Account
                        </button>
                    </div>
                </div>

                <h1 className="text-3xl font-serif text-navy text-center mb-2">
                    { isLoginMode ? 'Welcome back' : 'Join SCOTLAND' }
                </h1>
                <p className="text-zinc-500 text-sm text-center mb-8">
                    { isLoginMode ? 'Enter your details to access your account securely.' : 'Create an account to securely save your preferences and checkout seamlessly.' }
                </p>

                { error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 flex items-start">
                        <svg className="w-5 h-5 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 } d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{ error }</span>
                    </div>
                ) }

                <form action={ handleSubmit } className="space-y-5">
                    <input type="hidden" name="redirect" value={ redirectTo } />

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Email address</label>
                        <input
                            name="email"
                            type="email"
                            required
                            placeholder="you@email.com"
                            className="w-full px-4 py-3 bg-[#f8f9fa] border-2 border-stone focus:border-navy focus:bg-white rounded-xl outline-none transition-all duration-300"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Password</label>
                        <input
                            name="password"
                            type="password"
                            required
                            placeholder="••••••••"
                            className="w-full px-4 py-3 bg-[#f8f9fa] border-2 border-stone focus:border-navy focus:bg-white rounded-xl outline-none transition-all duration-300"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={ isPending }
                        className={ `w-full py-3.5 mt-4 rounded-xl font-medium tracking-wide text-white transition-all duration-300 shadow-[0_4px_14px_0_rgba(10,25,47,0.39)] 
              ${ isPending ? 'bg-navy/70 cursor-not-allowed' : 'bg-navy hover:bg-navy/90 hover:shadow-[0_6px_20px_0_rgba(10,25,47,0.23)] hover:-translate-y-px' }` }
                    >
                        { isPending ? 'Processing securely...' : ( isLoginMode ? 'Sign In' : 'Create Account' ) }
                    </button>

                    <div className="relative py-3 flex items-center">
                        <div className="flex-grow border-t border-stone"></div>
                        <span className="flex-shrink-0 mx-4 text-zinc-400 text-xs uppercase tracking-wider">or</span>
                        <div className="flex-grow border-t border-stone"></div>
                    </div>

                    <button
                        type="button"
                        onClick={ async () =>
                        {
                            const { createClient } = await import( '@/lib/supabase/client' );
                            const supabase = createClient();
                            await supabase.auth.signInWithOAuth( {
                                provider: 'google',
                                options: { redirectTo: `${ window.location.origin }/api/auth/callback?redirect=${ redirectTo }` }
                            } );
                        } }
                        className="w-full py-3.5 flex items-center justify-center gap-3 bg-white border-2 border-stone rounded-xl text-navy font-medium hover:bg-[#f8f9fa] transition-all duration-300 hover:-translate-y-px"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                    </button>
                </form>

                <p className="mt-8 text-center text-xs text-zinc-400 leading-relaxed">
                    By continuing, you agree to SCOTLAND's <br />
                    <Link href="#" className="underline hover:text-navy">Terms of Use</Link> and <Link href="#" className="underline hover:text-navy">Privacy Policy</Link>.
                </p>
            </div>
        </div>
    );
}

export default function LoginPage ()
{
    return (
        <main className="min-h-[85vh] bg-stone/5 flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-navy/5 rounded-full blur-[100px] pointer-events-none" />

            <Suspense fallback={ <div className="text-navy animate-pulse">Loading secure connection...</div> }>
                <LoginContent />
            </Suspense>
        </main>
    );
}
