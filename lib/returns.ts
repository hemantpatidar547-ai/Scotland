export const RETURN_COURIER_CHARGE = 35;

export type ReturnableItem = {
    name?: string;
    totalPrice?: number | string;
    price?: number | string;
    quantity?: number | string;
};

export function getReturnItemAmount ( item: ReturnableItem ): number
{
    const totalPrice = Number( item.totalPrice );
    if ( Number.isFinite( totalPrice ) && totalPrice > 0 ) return totalPrice;
    const price = Number( item.price );
    const quantity = Number( item.quantity || 1 );
    return Number.isFinite( price ) && Number.isFinite( quantity ) && price > 0 && quantity > 0
        ? price * quantity
        : 0;
}

export function getReturnItems (
    items: ReturnableItem[],
    indexes: number[] | null | undefined
)
{
    return ( indexes || [] ).flatMap( index =>
    {
        const item = items[ index ];
        if ( !item ) return [];
        return [ {
            name: item.name || 'Product',
            quantity: Number( item.quantity || 1 ),
            amount: getReturnItemAmount( item ),
        } ];
    } );
}
