import { AccountAddresses, AccountProfileForm } from '@/components/AccountProfileForms';

export default function AccountProfile ()
{
    return (
        <main className="shell py-12">
            <p className="eyebrow">My account</p>
            <h1 className="display mt-2 text-5xl">Profile & addresses</h1>
            <AccountProfileForm />
            <AccountAddresses />
        </main>
    );
}
