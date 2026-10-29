import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getProductsByIds } from '@/lib/data';
import { getAuthenticatedCustomer } from '@/lib/customer-auth';

const storePayload = z.object( {
    cart: z.array( z.object( {
        productId: z.string().min( 1 ).max( 255 ),
        variantId: z.string().min( 1 ).max( 255 ),
        size: z.string().min( 1 ).max( 80 ),
        color: z.string().min( 1 ).max( 80 ),
        quantity: z.number().int().min( 1 ).max( 99 ),
    } ) ).max( 100 ),
    favorites: z.array( z.string().min( 1 ).max( 255 ) ).max( 1000 ),
} );

function isSameOrigin ( request: NextRequest ): boolean
{
    const origin = request.headers.get( 'origin' );
    return !origin || origin === request.nextUrl.origin;
}

async function loadCustomerStore ( userId: string, db: NonNullable<Awaited<ReturnType<typeof getAuthenticatedCustomer>>['db']> )
{
    const { data: cart, error: cartError } = await db
        .from( 'carts' )
        .select( 'id' )
        .eq( 'user_id', userId )
        .maybeSingle();
    if ( cartError ) throw cartError;

    const [ itemsResult, wishlistResult ] = await Promise.all( [
        cart
            ? db.from( 'cart_items' ).select( 'product_id, variant_id, quantity' ).eq( 'cart_id', cart.id )
            : Promise.resolve( { data: [], error: null } ),
        db.from( 'wishlists' ).select( 'product_id' ).eq( 'user_id', userId ),
    ] );
    if ( itemsResult.error ) throw itemsResult.error;
    if ( wishlistResult.error ) throw wishlistResult.error;

    const products = await getProductsByIds( ( itemsResult.data || [] ).map( item => item.product_id ) );
    const customerCart = ( itemsResult.data || [] ).flatMap( item =>
    {
        const product = products.find( candidate => candidate.id === item.product_id );
        const variant = product?.inventoryVariants?.find( candidate => candidate.id === item.variant_id );
        if ( !product || !variant ) return [];
        return [ {
            product,
            productId: item.product_id,
            variantId: item.variant_id,
            size: variant.size,
            color: variant.color,
            quantity: Number( item.quantity ),
        } ];
    } );

    return {
        userId,
        cart: customerCart,
        favorites: ( wishlistResult.data || [] ).map( item => item.product_id ),
    };
}

async function syncCart (
    userId: string,
    cart: z.infer<typeof storePayload>['cart'],
    db: NonNullable<Awaited<ReturnType<typeof getAuthenticatedCustomer>>['db']>
)
{
    const combined = new Map<string, { variant_id: string; quantity: number }>();
    for ( const item of cart )
    {
        const current = combined.get( item.variantId );
        combined.set( item.variantId, {
            variant_id: item.variantId,
            quantity: Math.min( 99, ( current?.quantity || 0 ) + item.quantity ),
        } );
    }

    const submittedVariants = cart.length
        ? await db.from( 'product_variants' )
            .select( 'id, product_id, size, color, is_active' )
            .in( 'id', Array.from( new Set( cart.map( item => item.variantId ) ) ) )
        : { data: [], error: null };
    if ( submittedVariants.error ) throw submittedVariants.error;

    const requestedByVariant = new Map( cart.map( item => [ item.variantId, item ] ) );
    const databaseVariants = new Map( ( submittedVariants.data || [] ).map( variant => [ variant.id, variant ] ) );
    if ( requestedByVariant.size !== databaseVariants.size )
    {
        throw new Error( 'A selected product variant is no longer available.' );
    }
    for ( const [ variantId, item ] of requestedByVariant )
    {
        const variant = databaseVariants.get( variantId );
        if ( !variant || !variant.is_active || variant.product_id !== item.productId ||
            ( variant.size || 'One size' ) !== item.size || ( variant.color || 'Default' ) !== item.color )
        {
            throw new Error( 'A selected product variant no longer matches the cart.' );
        }
    }

    const { error } = await db.rpc( 'sync_customer_cart', {
        p_user_id: userId,
        p_items: Array.from( combined.values() ),
    } );
    if ( error ) throw error;
}

function isMissingCartSyncMigration ( error: unknown ): boolean
{
    if ( !error || typeof error !== 'object' ) return false;
    const databaseError = error as { code?: string; message?: string };
    return databaseError.code === 'PGRST202' &&
        ( databaseError.message || '' ).toLowerCase().includes( 'sync_customer_cart' );
}

async function syncWishlist (
    userId: string,
    productIds: string[],
    db: NonNullable<Awaited<ReturnType<typeof getAuthenticatedCustomer>>['db']>
)
{
    const uniqueIds = Array.from( new Set( productIds ) );
    const validProducts = uniqueIds.length
        ? await db.from( 'products' ).select( 'id' ).in( 'id', uniqueIds ).eq( 'status', 'active' )
        : { data: [], error: null };
    if ( validProducts.error ) throw validProducts.error;
    const validIds = ( validProducts.data || [] ).map( product => product.id );

    const { error: deleteError } = await db.from( 'wishlists' ).delete().eq( 'user_id', userId );
    if ( deleteError ) throw deleteError;
    if ( validIds.length )
    {
        const { error } = await db.from( 'wishlists' ).insert(
            validIds.map( product_id => ( { user_id: userId, product_id } ) )
        );
        if ( error ) throw error;
    }
}

export async function GET ()
{
    try
    {
        const { user, db } = await getAuthenticatedCustomer();
        if ( !user || !db ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
        return NextResponse.json( { data: await loadCustomerStore( user.id, db ) } );
    } catch ( error )
    {
        console.error( 'Customer store fetch failed:', error );
        return NextResponse.json( { error: 'Could not load your saved cart and wishlist.' }, { status: 500 } );
    }
}

export async function POST ( request: NextRequest )
{
    if ( !isSameOrigin( request ) ) return NextResponse.json( { error: 'Invalid request origin.' }, { status: 403 } );

    try
    {
        const { user, db } = await getAuthenticatedCustomer();
        if ( !user || !db ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
        const input = storePayload.safeParse( await request.json() );
        if ( !input.success ) return NextResponse.json( { error: 'Invalid cart or wishlist data.' }, { status: 400 } );

        const existing = await loadCustomerStore( user.id, db );
        const sanitizedGuestCart = input.data.cart.filter( item => item.productId && item.variantId );
        const mergedCart = [ ...existing.cart.map( item => ( {
            productId: item.productId,
            variantId: item.variantId,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
        } ) ), ...sanitizedGuestCart ];
        await syncCart( user.id, mergedCart, db );

        const sanitizedFavorites = [ ...existing.favorites, ...input.data.favorites ].filter( ( id, index, all ) => id && all.indexOf( id ) === index );
        await syncWishlist( user.id, sanitizedFavorites, db );

        return NextResponse.json( { data: await loadCustomerStore( user.id, db ) } );
    } catch ( error )
    {
        console.error( 'Guest store merge failed:', error );
        if ( isMissingCartSyncMigration( error ) )
        {
            return NextResponse.json(
                { error: 'Saved cart database setup is incomplete. Run supabase/migrations/0004_customer_accounts.sql in the Supabase SQL Editor.' },
                { status: 503 }
            );
        }
        const message = error instanceof Error ? error.message : '';
        const outOfStock = message.toLowerCase().includes( 'stock' ) || message.toLowerCase().includes( 'available' );
        return NextResponse.json(
            { error: outOfStock ? 'Some saved cart quantities are no longer available. Review your cart.' : 'Could not merge your saved cart and wishlist.' },
            { status: outOfStock ? 409 : 500 }
        );
    }
}

export async function PUT ( request: NextRequest )
{
    if ( !isSameOrigin( request ) ) return NextResponse.json( { error: 'Invalid request origin.' }, { status: 403 } );

    try
    {
        const { user, db } = await getAuthenticatedCustomer();
        if ( !user || !db ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
        const input = storePayload.safeParse( await request.json() );
        if ( !input.success ) return NextResponse.json( { error: 'Invalid cart or wishlist data.' }, { status: 400 } );

        const sanitizedCart = input.data.cart.filter( item => item.productId && item.variantId );
        await syncCart( user.id, sanitizedCart, db );
        await syncWishlist( user.id, input.data.favorites.filter( id => id && id.trim().length > 0 ), db );

        return NextResponse.json( { data: await loadCustomerStore( user.id, db ) } );
    } catch ( error )
    {
        console.error( 'Customer store update failed:', error );
        if ( isMissingCartSyncMigration( error ) )
        {
            return NextResponse.json(
                { error: 'Saved cart database setup is incomplete. Run supabase/migrations/0004_customer_accounts.sql in the Supabase SQL Editor.' },
                { status: 503 }
            );
        }
        const message = error instanceof Error ? error.message : '';
        const unavailable = message.toLowerCase().includes( 'stock' ) || message.toLowerCase().includes( 'available' );
        return NextResponse.json(
            { error: unavailable ? 'A cart item is no longer available in that quantity.' : 'Could not save your cart and wishlist.' },
            { status: unavailable ? 409 : 500 }
        );
    }
}
