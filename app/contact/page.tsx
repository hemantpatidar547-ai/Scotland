export default function Contact ()
{
    return (
        <main className="shell max-w-4xl py-16">
            <p className="eyebrow">Get in touch</p>
            <h1 className="display mt-3 text-5xl sm:text-6xl">We'd love to hear<br />from you.</h1>

            <div className="mt-12 grid gap-12 sm:grid-cols-2">
                <div>
                    <h2 className="font-display text-2xl">Customer Service</h2>
                    <p className="mt-4 text-zinc-600">
                        For inquiries regarding your orders, styling advice, or general questions, please email us.
                    </p>
                    <a href="mailto:support@scotland.com" className="mt-4 inline-block font-mono text-xs text-navy border-b border-navy/30 pb-0.5 hover:border-navy transition">
                        support@scotland.com
                    </a>
                </div>

                <div>
                    <h2 className="font-display text-2xl">Press & Wholesale</h2>
                    <p className="mt-4 text-zinc-600">
                        For press inquiries, brand partnerships, or wholesale opportunities, please reach out to our team.
                    </p>
                    <a href="mailto:partners@scotland.com" className="mt-4 inline-block font-mono text-xs text-navy border-b border-navy/30 pb-0.5 hover:border-navy transition">
                        partners@scotland.com
                    </a>
                </div>
            </div>

            <div className="mt-16 bg-cream p-8 sm:p-12 border border-stone">
                <h2 className="font-display text-2xl mb-6">Send us a message</h2>
                <form className="space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-widest text-navy mb-2">Name</label>
                            <input type="text" className="w-full border border-stone bg-transparent px-4 py-3 placeholder:text-stone focus:border-navy focus:outline-none transition text-sm" placeholder="Your name" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-widest text-navy mb-2">Email</label>
                            <input type="email" className="w-full border border-stone bg-transparent px-4 py-3 placeholder:text-stone focus:border-navy focus:outline-none transition text-sm" placeholder="Your email address" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-widest text-navy mb-2">Message</label>
                        <textarea rows={ 4 } className="w-full border border-stone bg-transparent px-4 py-3 placeholder:text-stone focus:border-navy focus:outline-none transition text-sm resize-none" placeholder="How can we help you?"></textarea>
                    </div>
                    <button type="button" className="bg-navy text-white px-8 py-3 text-xs font-semibold uppercase tracking-widest hover:bg-black transition">
                        Submit
                    </button>
                </form>
            </div>
        </main>
    );
}
