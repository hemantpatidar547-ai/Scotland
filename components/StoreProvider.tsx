'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Product } from '@/types/product';

export type CartItem = {
    product: Product;
    size: string;
    color: string;
    quantity: number;
    variantId?: string;
};

type Store = {
    cart: CartItem[];
    favorites: string[];
    isReady: boolean;
    syncError: string | null;
    addToCart: ( product: Product, size: string, color: string ) => Promise<boolean>;
    removeFromCart: ( itemKey: string ) => void;
    setQty: ( itemKey: string, quantity: number ) => void;
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
            try
            {
                const rawCart = JSON.parse( localStorage.getItem( GUEST_CART_KEY ) || '[]' );
                const rawFavorites = JSON.parse( localStorage.getItem( GUEST_FAVORITES_KEY ) || '[]' );
                guestCart = Array.isArray( rawCart ) ? rawCart.map( ( item: CartItem ) => ( {
                    ...item,
                    variantId: item.variantId || item.product?.inventoryVariants?.find(
                        variant => variant.size === item.size && variant.color === item.color
                    )?.id,
                } ) ).filter( item => item.product?.id && item.quantity > 0 ) : [];
                guestFavorites = Array.isArray( rawFavorites ) ? rawFavorites : [];
            } catch ( error )
            {
                console.warn( 'Could not restore the guest shopping session.', error );
            }

            if ( !active ) return;
            setCart( guestCart );
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
                    console.error( 'Could not save account cart/wishlist:', result.error || response.statusText );
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
    }, [ accountId, cart, favorites, hydrated, readyToSync ] );

    useEffect( () =>
    {
        if ( !accountId ) return;
        const refreshAccountState = async () =>
        {
            try
            {
                const response = await fetch( '/api/account/store', { cache: 'no-store' } );
                if ( response.status === 401 )
                {
                    setAccountId( null );
                    return;
                }
                if ( !response.ok ) return;
                const result = await response.json();
                applyAccountState( result.data as StoredAccountState );
            } catch ( error )
            {
                console.error( 'Could not refresh the cross-device shopping session:', error );
            }
        };
        window.addEventListener( 'focus', refreshAccountState );
        return () => window.removeEventListener( 'focus', refreshAccountState );
    }, [ accountId, applyAccountState ] );

    const value = useMemo<Store>( () => ( {
        cart,
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

                if ( existingItem )
                {
                    existingItem.quantity = Math.min( 99, existingItem.quantity + 1 );
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
                if ( !saveResponse.ok ) throw new Error( saveResult.error || 'Could not save the item to your account cart.' );

                applyAccountState( saveResult.data as StoredAccountState );
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
        setQty: ( itemKey, quantity ) => setCart( current => current.map( item =>
            cartItemKey( item ) === itemKey ? { ...item, quantity } : item
        ).filter( item => item.quantity > 0 ) ),
        toggleFavorite: id => setFavorites( current => current.includes( id )
            ? current.filter( favorite => favorite !== id )
            : [ ...current, id ] ),
        clearCart: () => setCart( [] ),
    } ), [ accountId, cart, favorites, readyToSync, syncError, applyAccountState ] );

    return <StoreContext.Provider value={ value }>{ children }</StoreContext.Provider>;
}

export const useStore = () =>
{
    const context = useContext( StoreContext );
    if ( !context ) throw new Error( 'StoreProvider missing' );
    return context;
};
