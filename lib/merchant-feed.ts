import type { Product } from '@/types/product';
import { absoluteSiteUrl, isPublicHttpUrl } from '@/lib/seo';

function escapeXml ( value: unknown ): string
{
    return String( value ?? '' )
        .replace( /&/g, '&amp;' )
        .replace( /</g, '&lt;' )
        .replace( />/g, '&gt;' )
        .replace( /"/g, '&quot;' )
        .replace( /'/g, '&apos;' );
}

function formatPrice ( value: number ): string
{
    return `${ Math.max( 0, value ).toFixed( 2 ) } INR`;
}

export type FeedIssue = {
    productId: string;
    productName: string;
    reason: string;
};

export function validateMerchantProducts ( products: Product[] ): { eligible: Product[]; issues: FeedIssue[] }
{
    const eligible: Product[] = [];
    const issues: FeedIssue[] = [];
    for ( const product of products.filter( item => item.status === 'published' && !item.no_index ) )
    {
        const issue = !product.name.trim()
            ? 'Missing product title.'
            : !product.description.trim()
                ? 'Missing product description.'
                : !product.brand_name?.trim()
                    ? 'Missing brand.'
                    : !isPublicHttpUrl( product.image )
                        ? 'Main image must be a public HTTP or HTTPS URL; embedded or relative images are not feed eligible.'
                        : !Number.isFinite( product.salePrice || product.price ) || ( product.salePrice || product.price ) <= 0
                            ? 'Price must be greater than zero.'
                            : null;
        if ( issue ) issues.push( { productId: product.id, productName: product.name, reason: issue } );
        else eligible.push( product );
    }
    return { eligible, issues };
}

function createItem ( product: Product, variant?: NonNullable<Product['inventoryVariants']>[number] ): string
{
    const price = variant?.salePrice || variant?.price || product.salePrice || product.price;
    const available = ( variant?.stockQuantity ?? product.stock ?? 0 ) > 0;
    const link = absoluteSiteUrl( `/products/${ product.slug }` );
    const color = variant?.color;
    const size = variant?.size;
    const images = [ ...new Set( [ product.image, ...product.images ] ) ].filter( isPublicHttpUrl );
    const identifier = variant
        ? variant.sku || `${ product.sku || product.id }-${ color || 'default' }-${ size || 'one-size' }`.toLowerCase().replace( /[^a-z0-9_-]+/g, '-' )
        : product.sku || product.id;
    const gender = product.gender === 'Men' ? 'male' : product.gender === 'Women' ? 'female' : 'unisex';

    return [
        '<item>',
        `<g:id>${ escapeXml( identifier ) }</g:id>`,
        `<g:title>${ escapeXml( [ product.name, color, size ].filter( Boolean ).join( ' - ' ) ) }</g:title>`,
        `<g:description>${ escapeXml( product.description ) }</g:description>`,
        `<g:link>${ escapeXml( link ) }</g:link>`,
        `<g:image_link>${ escapeXml( images[ 0 ] ) }</g:image_link>`,
        ...images.slice( 1, 11 ).map( image => `<g:additional_image_link>${ escapeXml( image ) }</g:additional_image_link>` ),
        `<g:availability>${ available ? 'in stock' : 'out of stock' }</g:availability>`,
        `<g:price>${ formatPrice( price ) }</g:price>`,
        `<g:brand>${ escapeXml( product.brand_name || 'SCOTLAND' ) }</g:brand>`,
        `<g:condition>new</g:condition>`,
        `<g:age_group>adult</g:age_group>`,
        `<g:item_group_id>${ escapeXml( product.sku || product.id ) }</g:item_group_id>`,
        `<g:product_type>${ escapeXml( [ product.category, product.subcategory ].filter( Boolean ).join( ' > ' ) ) }</g:product_type>`,
        `<g:gender>${ gender }</g:gender>`,
        ...( product.gtin ? [ `<g:gtin>${ escapeXml( product.gtin ) }</g:gtin>` ] : [] ),
        ...( product.mpn ? [ `<g:mpn>${ escapeXml( product.mpn ) }</g:mpn>` ] : [] ),
        ...( color ? [ `<g:color>${ escapeXml( color ) }</g:color>` ] : [] ),
        ...( size ? [ `<g:size>${ escapeXml( size ) }</g:size>` ] : [] ),
        '</item>',
    ].join( '' );
}

export function createMerchantFeedXml ( products: Product[] ): string
{
    const { eligible } = validateMerchantProducts( products );
    const items = eligible.flatMap( product =>
        product.inventoryVariants?.length
            ? product.inventoryVariants.map( variant => createItem( product, variant ) )
            : [ createItem( product ) ]
    ).join( '' );

    return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>SCOTLAND</title><link>${ escapeXml( absoluteSiteUrl( '/' ) ) }</link><description>Published SCOTLAND clothing products</description>${ items }</channel></rss>`;
}
