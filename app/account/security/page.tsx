import { PasswordUpdateForm } from '@/components/PasswordUpdateForm';

export default function AccountSecurity ()
{
    return (
        <main className="shell py-12">
            <p className="eyebrow">My account</p>
            <h1 className="display mt-2 text-5xl">Account security</h1>
            <section className="mt-8 max-w-xl rounded-xl border border-stone bg-white p-6">
                <h2 className="font-semibold">Change password</h2>
                <p className="mt-2 text-sm text-zinc-600">Your password is managed securely by Supabase Auth.</p>
                <PasswordUpdateForm />
            </section>
        </main>
    );
}
