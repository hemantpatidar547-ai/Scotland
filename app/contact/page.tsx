'use client';

import { useState, type FormEvent } from 'react';

export default function Contact ()
{
    const [ submitting, setSubmitting ] = useState( false );
    const [ message, setMessage ] = useState( '' );
    const [ error, setError ] = useState( '' );

    async function submitMessage ( event: FormEvent<HTMLFormElement> )
    {
        event.preventDefault();
        const form = event.currentTarget;
        setSubmitting( true );
        setMessage( '' );
        setError( '' );

        const formData = new FormData( form );
        try
        {
            const response = await fetch( '/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( {
                    name: formData.get( 'name' ),
                    phone: String( formData.get( 'phone' ) || '' ).replace( /\D/g, '' ),
                    message: formData.get( 'message' ),
                } ),
            } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not send your message. Please try again.' );
            form.reset();
            setMessage( 'Thank you. Your message has been sent, and our team will contact you on your mobile number.' );
        } catch ( cause )
        {
            setError( cause instanceof Error ? cause.message : 'Could not send your message. Please try again.' );
        } finally
        {
            setSubmitting( false );
        }
    }

    return (
        <main className="shell max-w-4xl py-16">
            <p className="eyebrow">Get in touch</p>
            <h1 className="display mt-3 text-5xl sm:text-6xl">We'd love to hear<br />from you.</h1>

            <div className="mt-12 grid gap-12">
                <div>
                    <h2 className="font-display text-2xl">Customer Service</h2>
                    <p className="mt-4 text-zinc-600">
                        For inquiries regarding your orders, styling advice, or general questions, please email us.
                    </p>
                    <a href="mailto:support@scotland.com" className="mt-4 inline-block font-mono text-xs text-navy border-b border-navy/30 pb-0.5 hover:border-navy transition">
                        support@scotland.com
                    </a>
                </div>
            </div>

            <div className="mt-16 border border-stone bg-cream p-8 sm:p-12">
                <h2 className="mb-6 font-display text-2xl">Send us a message</h2>
                <form className="space-y-6" onSubmit={ submitMessage }>
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div>
                            <label htmlFor="contact-name" className="mb-2 block text-xs font-semibold uppercase tracking-widest text-navy">Name</label>
                            <input id="contact-name" name="name" type="text" required minLength={ 2 } maxLength={ 100 } autoComplete="name" className="w-full border border-stone bg-transparent px-4 py-3 text-sm transition placeholder:text-stone focus:border-navy focus:outline-none" placeholder="Your name" />
                        </div>
                        <div>
                            <label htmlFor="contact-phone" className="mb-2 block text-xs font-semibold uppercase tracking-widest text-navy">Mobile number</label>
                            <input id="contact-phone" name="phone" type="tel" required inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" minLength={ 10 } maxLength={ 10 } className="w-full border border-stone bg-transparent px-4 py-3 text-sm transition placeholder:text-stone focus:border-navy focus:outline-none" placeholder="10-digit mobile number" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="contact-message" className="mb-2 block text-xs font-semibold uppercase tracking-widest text-navy">Message</label>
                        <textarea id="contact-message" name="message" rows={ 4 } required minLength={ 10 } maxLength={ 2000 } className="w-full resize-none border border-stone bg-transparent px-4 py-3 text-sm transition placeholder:text-stone focus:border-navy focus:outline-none" placeholder="How can we help you?" />
                    </div>
                    { message && <p className="text-sm text-emerald-800" role="status">{ message }</p> }
                    { error && <p className="text-sm text-rose-700" role="alert">{ error }</p> }
                    <button disabled={ submitting } type="submit" className="bg-navy px-8 py-3 text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60">
                        { submitting ? 'Sending…' : 'Submit' }
                    </button>
                </form>
            </div>
        </main>
    );
}
