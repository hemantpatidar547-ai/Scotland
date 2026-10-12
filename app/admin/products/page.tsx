import Link from 'next/link';
import { getAdminProducts } from '@/lib/data';
import { AdminProductsTable } from '@/components/admin/AdminProductsTable';

export default async function AdminProducts ()
{
    const products = await getAdminProducts();

    return (
        <main className="shell py-12">
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
