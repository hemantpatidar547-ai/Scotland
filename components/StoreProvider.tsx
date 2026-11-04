'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Product } from '@/types/product';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { getBuyThreeTshirtGiftCount, type PromoGiftSelection } from '@/lib/buy-3-get-tshirt';

export type CartItem = {
    product: Product;
    size: string;
    color: string;
    quantity: number;
    variantId?: string;
};

type Store = {
    cart: CartItem[];
    promoGifts: PromoGiftSelection[];
    favorites: string[];
    isReady: boolean;
    syncError: string | null;
    addToCart: ( product: Product, size: string, color: string ) => Promise<boolean>;
    removeFromCart: ( itemKey: string ) => void;
    setQty: ( itemKey: string, quantity: number ) => void;
    addPromoGift: ( gift: PromoGiftSelection ) => boolean;
    removePromoGift: ( index: number ) => void;
    toggleFavorite: ( id: string ) => void;
    clearCart: () => void;
};

type StoredAccountState = {
    userId: string;
    cart: Array<CartItem & { productId: string }>;
    favorites: string[];
};

const StoreContext = createContext<Store | null>( null );
const GUEST_CART_KEY = 'scotland-cart';
const GUEST_FAVORITES_KEY = 'scotland-favorites';
const PROMO_GIFTS_KEY = 'scotland-buy-3-get-tshirt-gifts';
const PENDING_ADD_TO_BAG_KEY = 'scotland-pending-add-to-bag';

export function cartItemKey ( item: Pick<CartItem, 'product' | 'size' | 'color'> ): string
{
    return `${ item.product.id }::${ item.color }::${ item.size }`;
}

function compressProductForCart ( product: Product ): Product
{
    return { ...product, description: '', shortDescription: '', images: [] };
}

function toServerCart ( cart: CartItem[] )
{
    return cart.flatMap( item => item.variantId ? [ {
        productId: item.product.id,
        variantId: item.variantId,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
    } ] : [] );
}

function sendProductToLogin ( product: Product, size: string, color: string )
{
    localStorage.setItem( PENDING_ADD_TO_BAG_KEY, JSON.stringify( {
        productId: product.id,
        size,
        color,
    } ) );
    const returnTo = `/products/${ encodeURIComponent( product.slug ) }?resumeAddToBag=1`;
    window.location.assign( `/login?redirect=${ encodeURIComponent( returnTo ) }` );
}

export function StoreProvider ( { children }: { children: React.ReactNode } )
{
    const [ cart, setCart ] = useState<CartItem[]>( [] );
    const [ promoGifts, setPromoGifts ] = useState<PromoGiftSelection[]>( [] );
    const [ favorites, setFavorites ] = useState<string[]>( [] );
    const [ hydrated, setHydrated ] = useState( false );
    const [ accountId, setAccountId ] = useState<string | null>( null );
    const [ readyToSync, setReadyToSync ] = useState( false );
    const [ syncError, setSyncError ] = useState<string | null>( null );

    const applyAccountState = useCallback( ( state: StoredAccountState ) =>
    {
        setAccountId( state.userId );
        setSyncError( null );
        setCart( state.cart.map( item => ( {
            product: compressProductForCart( item.product ),
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            variantId: item.variantId,
        } ) ) );
        setFavorites( state.favorites );
    }, [] );

    useEffect( () =>
    {
        let active = true;

        const initialize = async () =>
        {
            let guestCart: CartItem[] = [];
            let guestFavorites: string[] = [];
            let savedPromoGifts: PromoGiftSelection[] = [];
            try
            {
                const rawCart = JSON.parse( localStorage.getItem( GUEST_CART_KEY ) || '[]' );
                const rawFavorites = JSON.parse( localStorage.getItem( GUEST_FAVORITES_KEY ) || '[]' );
                const rawPromoGifts = JSON.parse( localStorage.getItem( PROMO_GIFTS_KEY ) || '[]' );
                guestCart = Array.isArray( rawCart ) ? rawCart.map( ( item: CartItem ) => ( {
                    ...item,
                    variantId: item.variantId || item.product?.inventoryVariants?.find(
                        variant => variant.size === item.size && variant.color === item.color
                    )?.id,
                } ) ).filter( item => item.product?.id && item.quantity > 0 ) : [];
                guestFavorites = Array.isArray( rawFavorites ) ? rawFavorites : [];
                savedPromoGifts = Array.isArray( rawPromoGifts ) ? rawPromoGifts.filter( ( gift: PromoGiftSelection ) =>
                    typeof gift.productId === 'string' &&
                    typeof gift.variantId === 'string' &&
                    typeof gift.name === 'string' &&
                    typeof gift.image === 'string' &&
                    typeof gift.size === 'string' &&
                    typeof gift.color === 'string'
                ) : [];
            } catch ( error )
            {
                console.warn( 'Could not restore the guest shopping session.', error );
            }

            if ( !active ) return;
            setCart( guestCart );
            setPromoGifts( savedPromoGifts );
            setFavorites( guestFavorites );
            setHydrated( true );

            try
            {
                const response = await fetch( '/api/account/store', { cache: 'no-store' } );
                if ( response.status === 401 )
                {
                    if ( active ) setReadyToSync( true );
                    return;
                }
                const result = await response.json();
                if ( !response.ok ) throw new Error( result.error || 'Could not load account cart.' );

                const accountState = result.data as StoredAccountState;
                const guestItems = guestCart.flatMap( item => item.variantId ? [ {
                    productId: item.product.id,
                    variantId: item.variantId,
                    size: item.size,
                    color: item.color,
                    quantity: item.quantity,
                } ] : [] );
                const guestWishlist = guestFavorites.filter( id => typeof id === 'string' && id.trim().length > 0 );

                if ( guestItems.length || guestWishlist.length )
                {
                    const merged = await fetch( '/api/account/store', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify( { cart: guestItems, favorites: guestWishlist } ),
                    } );
                    const mergedResult = await merged.json();
                    if ( !merged.ok ) throw new Error( mergedResult.error || 'Could not merge guest shopping data.' );
                    if ( !active ) return;
                    applyAccountState( mergedResult.data as StoredAccountState );
                    localStorage.removeItem( GUEST_CART_KEY );
                    localStorage.removeItem( GUEST_FAVORITES_KEY );
                } else if ( active )
                {
                    applyAccountState( accountState );
                }
            } catch ( error )
            {
                console.error( 'Could not synchronize the saved shopping session:', error );
                if ( active )
                {
                    setSyncError( error instanceof Error ? error.message : 'Your saved cart could not be synchronized.' );
                }
            } finally
            {
                if ( active ) setReadyToSync( true );
            }
        };

        void initialize();
        return () => { active = false; };
    }, [ applyAccountState ] );

    useEffect( () =>
    {
        if ( !hydrated || !readyToSync ) return;

        const cartKey = accountId ? `scotland-cart:${ accountId }` : GUEST_CART_KEY;
        const wishlistKey = accountId ? `scotland-favorites:${ accountId }` : GUEST_FAVORITES_KEY;
        try
        {
            localStorage.setItem( cartKey, JSON.stringify( cart ) );
            localStorage.setItem( wishlistKey, JSON.stringify( favorites ) );
            localStorage.setItem( PROMO_GIFTS_KEY, JSON.stringify( promoGifts ) );
        } catch ( error )
        {
            console.warn( 'Could not cache the shopping session locally.', error );
        }

        if ( !accountId ) return;
        const timer = window.setTimeout( () =>
        {
            void fetch( '/api/account/store', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( {
                    cart: toServerCart( cart ),
                    favorites,
                } ),
            } ).then( async response =>
            {
                if ( !response.ok )
                {
                    const result = await response.json();
                    setSyncError( result.error || 'Your saved cart could not be synchronized.' );
                } else
                {
                    setSyncError( null );
                }
            } ).catch( error =>
            {
                console.error( 'Could not reach account cart service:', error );
                setSyncError( 'Could not reach the account service. Your changes remain on this device for now.' );
            } );
        }, 350 );

        return () => window.clearTimeout( timer );
    }, [ accountId, cart, favorites, promoGifts, hydrated, readyToSync ] );

    useEffect( () =>
    {
        const maximumGifts = getBuyThreeTshirtGiftCount(
            cart.reduce( ( total, item ) => total + item.quantity, 0 )
        );
        if ( promoGifts.length > maximumGifts )
            setPromoGifts( current => current.slice( 0, maximumGifts ) );
    }, [ cart, promoGifts.length ] );

    useEffect( () =>
    {
        if ( !accountId ) return;
        let refreshing = false;
        let active = true;
        let activeController: AbortController | null = null;
        const refreshAccountState = async () =>
        {
            if ( refreshing ) return;
            refreshing = true;
            const controller = new AbortController();
            activeController = controller;
            const timeout = window.setTimeout( () => controller.abort(), 10000 );
            try
            {
                const response = await fetch( '/api/account/store', {
                    cache: 'no-store',
                    signal: controller.signal,
                } );
                if ( response.status === 401 )
                {
                    if ( active ) setAccountId( null );
                    return;
                }
                if ( !response.ok )
                {
                    console.warn( `Could not refresh the cross-device shopping session (HTTP ${ response.status }).` );
                    return;
                }
                const result = await response.json();
                if ( active ) applyAccountState( result.data as StoredAccountState );
            } catch ( error )
            {
                if ( error instanceof DOMException && error.name === 'AbortError' ) return;
                console.warn( 'Could not refresh the cross-device shopping session. The current cart remains available.', error );
            } finally
            {
                window.clearTimeout( timeout );
                refreshing = false;
                if ( activeController === controller ) activeController = null;
            }
        };
        window.addEventListener( 'focus', refreshAccountState );
        return () =>
        {
            active = false;
            activeController?.abort();
            window.removeEventListener( 'focus', refreshAccountState );
        };
    }, [ accountId, applyAccountState ] );

    const value = useMemo<Store>( () => ( {
        cart,
        promoGifts,
        favorites,
        isReady: readyToSync,
        syncError,
        addToCart: async ( product, size, color ) =>
        {
            const variantId = product.inventoryVariants?.find( item => item.size === size && item.color === color )?.id;

            if ( !readyToSync )
            {
                setSyncError( 'Your saved cart is still loading. Please try again in a moment.' );
                return false;
            }

            if ( !variantId )
            {
                setSyncError( 'This product option is no longer available. Please refresh and try again.' );
                return false;
            }

            try
            {
                if ( !accountId )
                {
                    if ( syncError ) return false;
                    sendProductToLogin( product, size, color );
                    return false;
                }

                const accountResponse = await fetch( '/api/account/store', {
                    cache: 'no-store',
                    signal: AbortSignal.timeout( 15000 ),
                } );
                if ( accountResponse.status === 401 )
                {
                    setAccountId( null );
                    sendProductToLogin( product, size, color );
                    return false;
                }

                const accountResult = await accountResponse.json();
                if ( !accountResponse.ok ) throw new Error( accountResult.error || 'Could not load your account cart.' );

                const accountState = accountResult.data as StoredAccountState;
                const nextCart = accountState.cart.map( item => ( {
                    ...item,
                    product: compressProductForCart( item.product ),
                } ) );
                const existingItem = nextCart.find( item =>
                    item.product.id === product.id && item.size === size && item.color === color
                );
                const selectedVariant = ( existingItem?.product || product ).inventoryVariants?.find(
                    item => item.id === variantId
                );
                const availableStock = selectedVariant?.stockQuantity ?? 0;
                const requestedQuantity = ( existingItem?.quantity || 0 ) + 1;

                if ( requestedQuantity > availableStock )
                {
                    setSyncError(
                        availableStock > 0
                            ? `Only ${ availableStock } left for ${ color } / ${ size }. Reduce the quantity in your bag or choose another option.`
                            : `The ${ color } / ${ size } option is sold out. Choose another option.`
                    );
                    return false;
                }

                if ( existingItem )
                {
                    existingItem.quantity = requestedQuantity;
                } else
                {
                    nextCart.push( {
                        product: compressProductForCart( product ),
                        productId: product.id,
                        size,
                        color,
                        quantity: 1,
                        variantId,
                    } );
                }

                const saveResponse = await fetch( '/api/account/store', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    signal: AbortSignal.timeout( 15000 ),
                    body: JSON.stringify( {
                        cart: toServerCart( nextCart ),
                        favorites: accountState.favorites,
                    } ),
                } );
                const saveResult = await saveResponse.json();
                if ( !saveResponse.ok )
                {
                    const message = saveResult.error || 'Could not save the item to your account cart.';
                    if ( saveResponse.status === 409 )
                    {
                        setSyncError( message );
                        return false;
                    }
                    throw new Error( message );
                }

                applyAccountState( saveResult.data as StoredAccountState );
                trackAnalyticsEvent( 'add_to_cart', {
                    currency: 'INR',
                    value: ( product.salePrice || product.price ),
                    items: [ {
                        item_id: product.sku || product.id,
                        item_name: product.name,
                        item_variant: `${ color } / ${ size }`,
                        price: product.salePrice || product.price,
                        quantity: 1,
                    } ],
                } );
                return true;
            } catch ( error )
            {
                console.error( 'Could not add item to the account cart:', error );
                setSyncError( error instanceof DOMException && error.name === 'TimeoutError'
                    ? 'Saving your bag took too long. Please try again.'
                    : error instanceof Error ? error.message : 'Could not save this item to your account cart.' );
                return false;
            }
        },
        removeFromCart: itemKey => setCart( current => current.filter( item => cartItemKey( item ) !== itemKey ) ),
        setQty: ( itemKey, quantity ) =>
        {
            const item = cart.find( candidate => cartItemKey( candidate ) === itemKey );
            const availableStock = item?.product.inventoryVariants?.find(
                variant => variant.id === item.variantId
            )?.stockQuantity;
            if ( item && availableStock !== undefined && quantity > availableStock )
            {
                setSyncError( `Only ${ availableStock } left for ${ item.color } / ${ item.size }. Reduce the quantity or choose another option.` );
                return;
            }
            setCart( current => current.map( item =>
                cartItemKey( item ) === itemKey ? { ...item, quantity } : item
            ).filter( item => item.quantity > 0 ) );
        },
        addPromoGift: gift =>
        {
            const maximumGifts = getBuyThreeTshirtGiftCount(
                cart.reduce( ( total, item ) => total + item.quantity, 0 )
            );
            if ( promoGifts.length >= maximumGifts ) return false;
            setPromoGifts( current => [ ...current, gift ] );
            return true;
        },
        removePromoGift: index => setPromoGifts( current => current.filter( ( _, giftIndex ) => giftIndex !== index ) ),
        toggleFavorite: id => setFavorites( current => current.includes( id )
            ? current.filter( favorite => favorite !== id )
            : [ ...current, id ] ),
        clearCart: () =>
        {
            setCart( [] );
            setPromoGifts( [] );
        },
    } ), [ accountId, cart, promoGifts, favorites, readyToSync, syncError, applyAccountState ] );

    return <StoreContext.Provider value={ value }>{ children }</StoreContext.Provider>;
}

export const useStore = () =>
{
    const context = useContext( StoreContext );
    if ( !context ) throw new Error( 'StoreProvider missing' );
    return context;
};
