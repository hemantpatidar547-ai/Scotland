import type { Product } from '@/types/product';

function normalize ( value: string | undefined ): string
{
    return value?.trim().toLocaleLowerCase() || '';
}

export function getRecentlyUpdatedProducts ( products: Product[], limit: number ): Product[]
{
    return [ ...products ]
        .filter( product => product.status === 'published' )
        .sort( ( first, second ) =>
        {
            const firstUpdated = Date.parse( first.updatedAt || '' ) || 0;
            const secondUpdated = Date.parse( second.updatedAt || '' ) || 0;
            return secondUpdated - firstUpdated || first.id.localeCompare( second.id );
        } )
        .slice( 0, limit );
}

export function getRecommendedProducts ( product: Product, products: Product[], limit = 4 ): Product[]
{
    const currentCategory = normalize( product.category );
    const currentSubcategory = normalize( product.subcategory );
    const currentGender = normalize( product.gender );
    const currentTags = new Set( ( product.tags || [] ).map( normalize ).filter( Boolean ) );

    return products
        .filter( candidate => candidate.status === 'published' && candidate.id !== product.id )
        .map( candidate =>
        {
            const sharedTags = ( candidate.tags || [] )
                .map( normalize )
                .filter( tag => currentTags.has( tag ) ).length;
            const score =
                ( normalize( candidate.category ) === currentCategory ? 12 : 0 ) +
                ( currentSubcategory && normalize( candidate.subcategory ) === currentSubcategory ? 8 : 0 ) +
                Math.min( sharedTags, 3 ) * 3 +
                ( currentGender && normalize( candidate.gender ) === currentGender ? 2 : 0 ) +
                ( candidate.isBestSeller ? 2 : 0 ) +
                ( candidate.featured ? 1 : 0 ) +
                ( ( candidate.stock || 0 ) > 0 ? 1 : 0 );
            const updatedAt = Date.parse( candidate.updatedAt || '' ) || 0;
            return { candidate, score, updatedAt };
        } )
        .sort( ( first, second ) =>
            second.score - first.score ||
            second.updatedAt - first.updatedAt ||
            first.candidate.id.localeCompare( second.candidate.id )
        )
        .slice( 0, limit )
        .map( result => result.candidate );
}
