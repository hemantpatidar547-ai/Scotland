import { supabaseAdmin } from '@/lib/supabase/server';

export async function deleteProduct ( id: string )
{
    if ( !supabaseAdmin )
    {
        return { error: 'Supabase server key is missing. Add SUPABASE_SERVICE_ROLE_KEY to .env.local.', status: 503 } as const;
    }

    const { error: cartError } = await supabaseAdmin.from( 'cart_items' ).delete().eq( 'product_id', id );
    if ( cartError ) return { error: cartError.message, status: 400 } as const;

    const { error: orderItemError } = await supabaseAdmin
        .from( 'order_items' )
        .update( { product_id: null, variant_id: null } )
        .eq( 'product_id', id );
    if ( orderItemError ) return { error: orderItemError.message, status: 400 } as const;

    const { error: productError } = await supabaseAdmin.from( 'products' ).delete().eq( 'id', id );
    if ( productError ) return { error: productError.message, status: 400 } as const;

    return { data: { id }, status: 200 } as const;
}