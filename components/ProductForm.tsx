'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function ProductForm ()
{
    const [ loading, setLoading ] = useState( false );
    const [ imageBase64, setImageBase64 ] = useState<string | null>( null );
    const router = useRouter();

    const handleImageChange = ( e: React.ChangeEvent<HTMLInputElement> ) =>
    {
        const file = e.target.files?.[ 0 ];
        if ( file )
        {
            const reader = new FileReader();
            reader.onloadend = () =>
            {
                setImageBase64( reader.result as string );
            };
            reader.readAsDataURL( file );
        }
    };

    const submit = async ( e: FormEvent<HTMLFormElement> ) =>
    {
        e.preventDefault();
        setLoading( true );

        const formData = new FormData( e.currentTarget );
        const name = formData.get( 'name' ) as string;

        const rawData = {
            name,
            slug: name.toLowerCase().replace( /[^a-z0-9]+/g, '-' ).replace( /(^-|-$)/g, '' ),
            sku: formData.get( 'sku' ) as string,
            category: formData.get( 'category' ) as string,
            price: Number( formData.get( 'price' ) ),
            description: formData.get( 'description' ) as string,
            stock_quantity: Number( formData.get( 'stock' ) ),
            image: imageBase64 // send base64 string to database
        };

        try
        {
            const res = await fetch( '/api/admin/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( rawData ),
            } );
            if ( res.ok )
            {
                alert( 'Product with IMAGE saved to MongoDB successfully! 🚀' );
                router.push( '/admin/products' );
            } else
            {
                const error = await res.json();
                alert( 'Error: ' + JSON.stringify( error ) );
                setLoading( false );
            }
        } catch ( err )
        {
            alert( 'Network Error' );
            setLoading( false );
        }
    };

    return (
        <form onSubmit={ submit } className="mt-10 max-w-3xl space-y-5 bg-white p-6">
            <h2 className="display text-2xl">Basic information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs">Product name<input name="name" required className="input mt-2" placeholder="e.g. Glen Brushed Overshirt" /></label>
                <label className="text-xs">SKU<input name="sku" required className="input mt-2" placeholder="SC-001" /></label>
                <label className="text-xs">Category
                    <select name="category" className="input mt-2">
                        <option value="Clothing">Clothing</option>
                        <option value="Shoes">Shoes</option>
                        <option value="Accessories">Accessories</option>
                    </select>
                </label>
                <label className="text-xs">Price<input name="price" required min="1" type="number" className="input mt-2" placeholder="7490" /></label>
            </div>
            <label className="block text-xs">Description<textarea name="description" required className="input mt-2 min-h-28" placeholder="Product description" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs">Initial stock<input name="stock" className="input mt-2" type="number" min="0" placeholder="20" required /></label>
            </div>

            <label className="block rounded border border-dashed border-stone p-6 text-center text-xs text-zinc-500">
                Upload Product Image (will be saved in MongoDB)
                { imageBase64 && <img src={ imageBase64 } alt="Preview" className="mx-auto mt-4 h-32 object-contain" /> }
                <input type="file" onChange={ handleImageChange } className="mt-3 block w-full" accept="image/*" />
            </label>

            <button className="button" disabled={ loading }>{ loading ? 'Saving...' : 'Save product' }</button>
        </form>
    );
}
