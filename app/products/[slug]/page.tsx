import { notFound } from 'next/navigation'; import { findProduct } from '@/lib/products'; import { ProductDetails } from './product-details';
export default async function ProductPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const product=findProduct(slug);if(!product)notFound();return <ProductDetails product={product}/>}
