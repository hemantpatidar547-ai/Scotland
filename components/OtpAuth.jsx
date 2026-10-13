'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/* ── Google "G" Icon ── */
function GoogleIcon ()
{
    return (
        <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.1 24.1 0 0 0 0 21.56l7.98-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
    );
}

/* ── Shield Icon ── */
function ShieldIcon ()
{
    return (
        <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}

/* ══════════════════════════════════════
   Login with Google — Supabase OAuth
   ══════════════════════════════════════ */
export default function OtpAuth ()
{
    const [ loading, setLoading ] = useState( false );
    const [ error, setError ] = useState( '' );

    const handleGoogleLogin = async () =>
    {
        setLoading( true );
        setError( '' );

        try {
            const supabase = createClient();
            const { error: authError } = await supabase.auth.signInWithOAuth( {
                provider: 'google',
                options: {
                    redirectTo: `${ window.location.origin }/api/auth/callback`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            } );

            if ( authError ) {
                setError( authError.message || 'Failed to start Google login.' );
                setLoading( false );
            }
            // If no error, browser redirects to Google automatically
        } catch {
            setError( 'Something went wrong. Please try again.' );
            setLoading( false );
        }
    };

    return (
        <main className="min-h-[85vh] bg-cream/30 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Decorative blurs */ }
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-navy/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-md mx-auto bg-white/80 backdrop-blur-xl border border-stone/50 shadow-2xl rounded-2xl animate-[fadeSlideUp_0.5s_ease-out] relative z-10">
                <div className="p-8 sm:p-10">

                    {/* ── Brand Area ── */ }
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-navy/5 flex items-center justify-center mb-5">
                            <span className="text-2xl font-bold text-navy tracking-wide">S</span>
                        </div>
                        <h1 className="text-3xl font-display text-navy text-center">
                            Welcome to SCOTLAND
                        </h1>
                        <p className="text-zinc-500 text-sm text-center mt-2 max-w-xs">
                            Sign in with your Google account to continue shopping.
                        </p>
                    </div>

                    {/* ── Error ── */ }
                    { error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-3 animate-[fadeSlideUp_0.3s_ease-out]">
                            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 } d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{ error }</span>
                        </div>
                    ) }

                    {/* ── Google Login Button ── */ }
                    <button
                        type="button"
                        onClick={ handleGoogleLogin }
                        disabled={ loading }
                        className={ `w-full py-4 px-6 rounded-xl font-semibold text-[15px] tracking-wide transition-all duration-300
                            flex items-center justify-center gap-3 border-2
                            ${ loading
                                ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-white border-stone hover:border-navy hover:shadow-lg hover:-translate-y-px active:translate-y-0 text-navy'
                            }` }
                    >
                        { loading ? (
                            <>
                                <span className="w-5 h-5 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
                                Redirecting to Google…
                            </>
                        ) : (
                            <>
                                <GoogleIcon />
                                Continue with Google
                            </>
                        ) }
                    </button>

                    {/* ── Divider ── */ }
                    <div className="my-7 flex items-center gap-4">
                        <div className="flex-1 h-px bg-stone/60" />
                        <span className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Secure Login</span>
                        <div className="flex-1 h-px bg-stone/60" />
                    </div>

                    {/* ── Info Cards ── */ }
                    <div className="space-y-3 text-sm text-zinc-500">
                        <div className="flex items-center gap-3 p-3 bg-[#f8f9fa] rounded-xl">
                            <ShieldIcon />
                            <span>Your data is encrypted and secure</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-[#f8f9fa] rounded-xl">
                            <svg className="w-5 h-5 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>One-click sign in — no passwords needed</span>
                        </div>
                    </div>

                    {/* ── Footer ── */ }
                    <div className="mt-8 pt-6 border-t border-stone/50">
                        <p className="text-center text-[11px] text-zinc-400 leading-relaxed">
                            By continuing you agree to SCOTLAND&apos;s{ ' ' }
                            <a href="#" className="underline hover:text-navy transition-colors">Terms of Service</a> and{ ' ' }
                            <a href="#" className="underline hover:text-navy transition-colors">Privacy Policy</a>.
                        </p>
                    </div>

                </div>
            </div>

            <style jsx global>{ `
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </main>
    );
}
