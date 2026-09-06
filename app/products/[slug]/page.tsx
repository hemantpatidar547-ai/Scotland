import { notFound } from 'next/navigation'; import { getProductBySlug } from '@/lib/data'; import { ProductDetails } from './product-details';
export default async function ProductPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const product=await getProductBySlug(slug);if(!product)notFound();return <ProductDetails product={product}/>}
