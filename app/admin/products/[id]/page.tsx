import { notFound } from 'next/navigation';
import { ProductForm } from '@/components/ProductForm';
import { getAdminProductById } from '@/lib/data';

export default async function EditProduct ( { params }: { params: Promise<{ id: string }> } )
{
    const { id } = await params;
    const product = await getAdminProductById( id );
    if ( !product ) notFound();

    return (
        <main className="shell py-12">
            <p className="eyebrow">Catalog</p>
            <h1 className="display mt-2 text-5xl">Edit product</h1>
            <ProductForm initialData={ product } />
        </main>
    );
}
