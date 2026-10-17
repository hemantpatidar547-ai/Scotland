import Link from 'next/link';
import { HomepageShowcaseEditor } from '@/components/admin/HomepageShowcaseEditor';

export default function AdminHomepageContent ()
{
    return <main className="shell py-10 sm:py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p className="eyebrow">Storefront content</p>
                <h1 className="display mt-3 text-4xl sm:text-5xl">Homepage Content</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">Manage the homepage collection message, visibility, card titles, descriptions, and images here—no code changes needed.</p>
            </div>
            <Link className="button-outline" href="/admin">Back to dashboard</Link>
        </div>
        <HomepageShowcaseEditor />
    </main>;
}
