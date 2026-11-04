import Link from 'next/link';
import { getAdminProducts } from '@/lib/data';
import { AdminProductsTable } from '@/components/admin/AdminProductsTable';

export default async function AdminProducts ( { searchParams }: { searchParams: Promise<{ created?: string; updated?: string }> } )
{
    const [ products, params ] = await Promise.all( [ getAdminProducts(), searchParams ] );
    const successMessage = params.created === '1'
        ? 'Product added successfully.'
        : params.updated === '1'
            ? 'Product updated successfully.'
            : null;

    return (
        <main className="shell py-12">
            { successMessage && <p className="mb-6 rounded border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{ successMessage }</p> }
            <div className="flex items-center justify-between">
                <div>
                    <p className="eyebrow">Catalog</p>
                    <h1 className="display mt-2 text-5xl">Products</h1>
                    <p className="mt-2 text-sm text-zinc-500">Stock is shown for each size and color, and refreshes automatically.</p>
                </div>
                <Link className="button" href="/admin/products/new">Add product</Link>
            </div>
            <AdminProductsTable products={ products } />
        </main>
    );
}
