'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Product } from '@/types/product';
import { DeleteProductButton } from '@/components/DeleteProductButton';
import { ProductStatusToggle } from '@/components/ProductStatusToggle';

type InventoryVariant = {
    id: string;
    productId: string;
    color: string;
    size: string;
    stockQuantity: number;
};

export function AdminProductsTable ( { products }: { products: Product[] } )
{
    const [ inventoryRefreshError, setInventoryRefreshError ] = useState<string | null>( null );
    const [ inventory, setInventory ] = useState<Record<string, InventoryVariant[]>>(
        () => Object.fromEntries( products.map( product => [
            product.id,
            ( product.inventoryVariants || [] ).map( variant => ( { ...variant, productId: product.id } ) ),
        ] ) )
    );

    const refreshInventory = useCallback( async () =>
    {
        try
        {
            const response = await fetch( '/api/admin/products', { cache: 'no-store' } );
            const result = await response.json();
            if ( !response.ok )
            {
                setInventoryRefreshError(
                    response.status === 401
                        ? 'Live stock refresh requires an authorized admin session. Please sign in again.'
                        : result.error || 'Could not refresh live stock.'
                );
                return;
            }

            const nextInventory: Record<string, InventoryVariant[]> = {};
            for ( const variant of result.variants as InventoryVariant[] )
            {
                ( nextInventory[ variant.productId ] ||= [] ).push( variant );
            }
            setInventory( nextInventory );
            setInventoryRefreshError( null );
        } catch
        {
            setInventoryRefreshError( 'Live stock could not refresh. Showing the last available quantities.' );
        }
    }, [] );

    useEffect( () =>
    {
        void refreshInventory();
        const intervalId = window.setInterval( refreshInventory, 15000 );
        return () => window.clearInterval( intervalId );
    }, [ refreshInventory ] );

    return (
        <div className="mt-10 overflow-x-auto bg-white">
            { inventoryRefreshError && (
                <p className="mb-3 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
                    { inventoryRefreshError }
                </p>
            ) }
            <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-stone text-[10px] uppercase tracking-wider text-zinc-500">
                    <tr>
                        <th className="p-4">Product</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th className="min-w-[360px]">Live stock by size / color</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    { products.map( product =>
                    {
                        const variants = inventory[ product.id ] || [];
                        const totalStock = variants.reduce( ( total, variant ) => total + variant.stockQuantity, 0 );

                        return (
                            <tr className="border-b border-stone align-top" key={ product.id }>
                                <td className="p-4 font-semibold">
                                    { product.name }
                                    <span className="block pt-1 text-xs font-normal text-zinc-500">{ product.slug }</span>
                                </td>
                                <td className="pt-5">{ product.category }</td>
                                <td className="pt-5">₹{ Number( product.price ).toLocaleString() }</td>
                                <td className="py-3 pr-4">
                                    <p className="mb-2 text-xs font-semibold text-navy">Total available: { totalStock }</p>
                                    { variants.length ? (
                                        <div className="flex flex-wrap gap-2">
                                            { variants.map( variant => (
                                                <div className={ `flex items-center gap-2 rounded border px-2 py-1 ${ variant.stockQuantity <= 3 ? 'border-amber-300 bg-amber-50' : 'border-stone bg-stone-50' }` } key={ variant.id }>
                                                    <span className="text-[10px] font-semibold text-zinc-600">{ variant.color } / { variant.size }</span>
                                                    <span className="min-w-6 text-center text-xs font-semibold text-navy">{ variant.stockQuantity }</span>
                                                    { variant.stockQuantity <= 3 && <span className="text-[9px] font-semibold text-amber-700">Low</span> }
                                                </div>
                                            ) ) }
                                        </div>
                                    ) : <span className="text-xs text-zinc-500">No size/color variants</span> }
                                </td>
                                <td className="pt-5"><ProductStatusToggle productId={ product.id } initialStatus={ product.status || 'draft' } /></td>
                                <td className="pt-5">
                                    <div className="flex items-center gap-4">
                                        <Link className="text-xs underline hover:text-navy" href={ `/admin/products/${ product.id }` }>Edit</Link>
                                        <DeleteProductButton productId={ product.id } />
                                    </div>
                                </td>
                            </tr>
                        );
                    } ) }
                </tbody>
            </table>
        </div>
    );
}
