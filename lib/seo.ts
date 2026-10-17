import type { Product } from '@/types/product';

export const DEFAULT_SITE_URL = 'https://scotland-eight.vercel.app';

export function getSiteUrl (): URL
{
    const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    const siteUrl = new URL( configuredUrl || DEFAULT_SITE_URL );
    if ( siteUrl.protocol !== 'https:' && siteUrl.hostname !== 'localhost' )
        throw new Error( 'NEXT_PUBLIC_SITE_URL must use HTTPS outside localhost.' );
    return siteUrl;
}

export function absoluteSiteUrl ( path: string ): string
{
    return new URL( path, getSiteUrl() ).toString();
}

export function buildProductSeoSuggestions ( product: Pick<Product, 'name' | 'category' | 'subcategory' | 'gender' | 'description' | 'shortDescription' | 'brand_name' | 'slug'> )
{
    const keyword = [ product.gender, product.subcategory || product.category, product.name ]
        .filter( Boolean )
        .join( ' ' )
        .replace( /\s+/g, ' ' )
        .trim();
    const title = `${ product.name }${ product.subcategory ? ` ${ product.subcategory }` : '' } | ${ product.brand_name || 'SCOTLAND' }`
        .replace( /\s+/g, ' ' )
        .slice( 0, 70 );
    const description = ( product.shortDescription || product.description || `${ product.name} from ${ product.brand_name || 'SCOTLAND' }.` )
        .replace( /\s+/g, ' ' )
        .trim()
        .slice( 0, 160 );
    const slug = ( product.slug || product.name )
        .toLowerCase()
        .normalize( 'NFKD' )
        .replace( /[\u0300-\u036f]/g, '' )
        .replace( /[^a-z0-9]+/g, '-' )
        .replace( /(^-|-$)/g, '' );

    return { title, description, keyword, slug };
}

export function safeJsonLd ( value: unknown ): string
{
    return JSON.stringify( value ).replace( /</g, '\\u003c' );
}

export function isPublicHttpUrl ( value: string ): boolean
{
    if ( value.length > 2048 || !/^https?:\/\//i.test( value ) ) return false;
    try
    {
        const url = new URL( value );
        return ( url.protocol === 'https:' || url.protocol === 'http:' ) && !url.username && !url.password;
    } catch
    {
        return false;
    }
}
