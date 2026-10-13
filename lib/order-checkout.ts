import { z } from 'zod';

export const checkoutCartSchema = z.array( z.object( {
    productId: z.string().uuid(),
    variantId: z.string().uuid(),
    quantity: z.number().int().min( 1 ).max( 99 ),
    size: z.string().min( 1 ).max( 80 ).optional(),
    color: z.string().min( 1 ).max( 80 ).optional(),
} ) ).min( 1 ).max( 100 );

type CheckoutDatabase = {
    from: ( table: string ) => any;
};

export async function priceCheckoutCart (
    db: CheckoutDatabase,
    cartItems: z.infer<typeof checkoutCartSchema>
)
{
    const productIds = Array.from( new Set( cartItems.map( item => item.productId ) ) );
    const variantIds = Array.from( new Set( cartItems.map( item => item.variantId ) ) );
    const [ productsResult, variantsResult ] = await Promise.all( [
        db.from( 'products' )
            .select( 'id, name, sku, price, sale_price, status, product_images(image_url, display_order, is_primary)' )
            .in( 'id', productIds ),
        db.from( 'product_variants' )
            .select( 'id, product_id, sku, color, size, price, sale_price, is_active' )
            .in( 'id', variantIds )
            .eq( 'is_active', true ),
    ] );

    if ( productsResult.error ) throw productsResult.error;
    if ( variantsResult.error ) throw variantsResult.error;

    const products = new Map<string, any>( ( productsResult.data || [] ).map( ( product: any ) => [ product.id, product ] ) );
    const variants = new Map<string, any>( ( variantsResult.data || [] ).map( ( variant: any ) => [ variant.id, variant ] ) );
    const quantitiesByVariant = new Map<string, number>();

    const items = cartItems.map( item =>
    {
        const product = products.get( item.productId );
        const variant = variants.get( item.variantId );
        if ( !product || product.status !== 'active' || !variant || variant.product_id !== product.id )
        {
            throw new Error( `${ product?.name || 'A product' } is no longer available in this size or color.` );
        }
        if ( ( item.size && item.size !== ( variant.size || 'One size' ) ) ||
            ( item.color && item.color !== ( variant.color || 'Default' ) ) )
        {
            throw new Error( 'A selected product size or color no longer matches the cart.' );
        }

        const price = Number( variant.sale_price ?? product.sale_price ?? variant.price ?? product.price );
        if ( !Number.isFinite( price ) || price < 0 ) throw new Error( 'A product price is invalid. Please refresh your cart.' );
        quantitiesByVariant.set( variant.id, ( quantitiesByVariant.get( variant.id ) || 0 ) + item.quantity );

        const images = [ ...( product.product_images || [] ) ].sort(
            ( first: any, second: any ) => Number( first.display_order || 0 ) - Number( second.display_order || 0 )
        );
        const image = images.find( ( row: any ) => row.is_primary )?.image_url
            || images[ 0 ]?.image_url
            || '/images/brand/scotland-lion.png';

        return {
            productId: product.id,
            variantId: variant.id,
            sku: variant.sku || product.sku,
            name: product.name,
            image,
            size: variant.size || 'One size',
            color: variant.color || 'Default',
            quantity: item.quantity,
            price,
            totalPrice: price * item.quantity,
        };
    } );

    return {
        items,
        inventoryReservation: Array.from( quantitiesByVariant, ( [ variant_id, quantity ] ) => ( { variant_id, quantity } ) ),
        subtotal: items.reduce( ( total, item ) => total + item.totalPrice, 0 ),
    };
}

export async function getCheckoutShippingCost ( db: CheckoutDatabase, subtotal: number ): Promise<number>
{
    const { data, error } = await db.from( 'settings' )
        .select( 'free_delivery' )
        .eq( 'id', 'store' )
        .maybeSingle();

    if ( error && error.code !== '42P01' )
    {
        console.error( 'Could not read delivery settings:', error );
        throw new Error( 'Checkout delivery settings are temporarily unavailable.' );
    }

    return data?.free_delivery || subtotal >= 4000 ? 0 : 50;
}
