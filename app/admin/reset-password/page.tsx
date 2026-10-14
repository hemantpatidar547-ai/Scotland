import { PasswordUpdateForm } from '@/components/PasswordUpdateForm';

export default function AdminResetPasswordPage ()
{
    return (
        <main className="shell flex min-h-[75vh] items-center justify-center py-12">
            <section className="w-full max-w-md border border-stone bg-white p-6 shadow-sm sm:p-9">
                <p className="eyebrow text-zinc-500">Protected access</p>
                <h1 className="display mt-2 text-3xl">Set a new admin password</h1>
                <p className="mt-2 text-sm text-zinc-600">
                    Open this page from the Supabase password recovery email, then choose a new password.
                </p>
                <PasswordUpdateForm returnTo="/admin/login?passwordUpdated=1" />
            </section>
        </main>
    );
}
