export const BUY_THREE_GET_TSHIRT_GIFT_LIMIT = 1;

export type BuyThreeTshirtVariant = {
    id: string;
    color: string;
    size: string;
    stockQuantity: number;
};

export type BuyThreeTshirtOption = {
    productId: string;
    name: string;
    image: string;
    variants: BuyThreeTshirtVariant[];
};

export type PromoGiftSelection = {
    productId: string;
    variantId: string;
    name: string;
    image: string;
    size: string;
    color: string;
};

export function getBuyThreeTshirtGiftCount ( paidItemCount: number ): number
{
    return Math.floor( Math.max( 0, paidItemCount ) / 3 ) * BUY_THREE_GET_TSHIRT_GIFT_LIMIT;
}

export function isBuyThreeTshirtProduct ( name: unknown, category: unknown ): boolean
{
    const text = `${ typeof name === 'string' ? name : '' } ${ typeof category === 'string' ? category : '' }`;
    return /\b(?:t[\s-]?shirts?|tees?)\b/i.test( text );
}
