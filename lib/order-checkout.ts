import { z } from 'zod';
import { getBuyThreeTshirtGiftCount, isBuyThreeTshirtProduct } from '@/lib/buy-3-get-tshirt';

export const checkoutCartItemSchema = z.object( {
    productId: z.string().uuid(),
    variantId: z.string().uuid(),
    quantity: z.number().int().min( 1 ).max( 99 ),
    size: z.string().min( 1 ).max( 80 ).optional(),
    color: z.string().min( 1 ).max( 80 ).optional(),
} );

export const checkoutCartSchema = z.array( checkoutCartItemSchema ).min( 1 ).max( 100 );
export const checkoutPromoGiftItemsSchema = z.array( checkoutCartItemSchema ).max( 100 ).optional();

export const checkoutShippingAddressSchema = z.object( {
    name: z.string().trim().min( 2 ).max( 120 ),
    email: z.string().trim().email().max( 255 ),
    address: z.string().trim().min( 4 ).max( 300 ),
    city: z.string().trim().min( 1 ).max( 100 ),
    postalCode: z.string().trim().regex( /^[0-9]{6}$/ ),
    phone: z.string().trim().regex( /^[0-9]{10}$/ ),
    alternatePhone: z.union( [ z.literal( '' ), z.string().trim().regex( /^[0-9]{10}$/ ) ] ).optional(),
    country: z.literal( 'India' ),
} );

type CheckoutDatabase = {
    from: ( table: string ) => any;
};

export async function priceCheckoutCart (
    db: CheckoutDatabase,
    cartItems: z.infer<typeof checkoutCartSchema>,
    promoGiftItems: z.infer<typeof checkoutPromoGiftItemsSchema> = []
)
{
    const paidItemCount = cartItems.reduce( ( total, item ) => total + item.quantity, 0 );
    const requestedGiftCount = promoGiftItems.reduce( ( total, item ) => total + item.quantity, 0 );
    const allowedGiftCount = getBuyThreeTshirtGiftCount( paidItemCount );
    if ( requestedGiftCount > allowedGiftCount )
        throw new Error( 'Your cart does not qualify for that many free T-shirts. Refresh your cart and try again.' );

    const allCartItems = [ ...cartItems, ...promoGiftItems ];
    const productIds = Array.from( new Set( allCartItems.map( item => item.productId ) ) );
    const variantIds = Array.from( new Set( allCartItems.map( item => item.variantId ) ) );
    const [ productsResult, variantsResult ] = await Promise.all( [
        db.from( 'products' )
            .select( 'id, name, sku, price, sale_price, status, categories(name), product_images(image_url, display_order, is_primary)' )
            .in( 'id', productIds ),
        db.from( 'product_variants' )
            .select( 'id, product_id, sku, color, size, price, sale_price, is_active, stock_quantity, reserved_quantity' )
            .in( 'id', variantIds )
            .eq( 'is_active', true ),
    ] );

    if ( productsResult.error ) throw productsResult.error;
    if ( variantsResult.error ) throw variantsResult.error;

    const products = new Map<string, any>( ( productsResult.data || [] ).map( ( product: any ) => [ product.id, product ] ) );
    const variants = new Map<string, any>( ( variantsResult.data || [] ).map( ( variant: any ) => [ variant.id, variant ] ) );
    const quantitiesByVariant = new Map<string, number>();

    const items = allCartItems.map( ( item, itemIndex ) =>
    {
        const isFreeGift = itemIndex >= cartItems.length;
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
        if ( isFreeGift )
        {
            const category = Array.isArray( product.categories )
                ? product.categories[ 0 ]?.name
                : product.categories?.name;
            if ( !isBuyThreeTshirtProduct( product.name, category ) )
                throw new Error( 'Only an in-stock T-shirt can be selected as the free gift.' );
            if ( Number( variant.stock_quantity ) - Number( variant.reserved_quantity ) < item.quantity )
                throw new Error( 'The selected free T-shirt size is no longer in stock. Choose another size.' );
        }

        const listedPrice = Number( variant.sale_price ?? product.sale_price ?? variant.price ?? product.price );
        if ( !Number.isFinite( listedPrice ) || listedPrice < 0 ) throw new Error( 'A product price is invalid. Please refresh your cart.' );
        const price = isFreeGift ? 0 : listedPrice;
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
            isFreeGift,
        };
    } );

    return {
        items,
        inventoryReservation: Array.from( quantitiesByVariant, ( [ variant_id, quantity ] ) => ( { variant_id, quantity } ) ),
        subtotal: items.reduce( ( total, item ) => total + item.totalPrice, 0 ),
    };
}

export async function getCheckoutShippingCost (
    db: CheckoutDatabase,
    subtotal: number,
    courierCharge = 50
): Promise<number>
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

    return data?.free_delivery || subtotal >= 4000 ? 0 : courierCharge;
}
