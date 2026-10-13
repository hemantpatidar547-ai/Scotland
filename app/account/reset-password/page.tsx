import { PasswordUpdateForm } from '@/components/PasswordUpdateForm';

export default function ResetPassword ()
{
    return (
        <main className="shell flex min-h-[70vh] items-center justify-center py-12">
            <section className="w-full max-w-md rounded-xl border border-stone bg-white p-8">
                <p className="eyebrow">Account security</p>
                <h1 className="display mt-2 text-4xl">Choose a new password</h1>
                <p className="mt-3 text-sm text-zinc-600">Use at least eight characters. This link can only be used with the email that received it.</p>
                <PasswordUpdateForm />
            </section>
        </main>
    );
}
