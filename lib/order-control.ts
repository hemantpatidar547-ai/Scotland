import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase/db';
import { DEFAULT_ORDER_PAUSE_MESSAGE } from '@/lib/order-control-shared';

export { DEFAULT_ORDER_PAUSE_MESSAGE } from '@/lib/order-control-shared';

export type OrderControlStatus = {
    orderPaused: boolean;
    orderPauseMessage: string;
};

export async function getOrderControlStatus (): Promise<OrderControlStatus>
{
    const db = getSupabaseAdmin();
    const { data, error } = await db.from( 'settings' )
        .select( 'order_paused, order_pause_message' )
        .eq( 'id', 'store' )
        .maybeSingle();

    if ( error ) throw new OrderControlUnavailableError( 'Could not verify whether orders are open.' );
    if ( !data ) throw new OrderControlUnavailableError( 'Store order control settings are missing.' );

    return {
        orderPaused: data.order_paused === true,
        orderPauseMessage: typeof data.order_pause_message === 'string' && data.order_pause_message.trim()
            ? data.order_pause_message.trim()
            : DEFAULT_ORDER_PAUSE_MESSAGE,
    };
}

export class OrderControlUnavailableError extends Error
{
    constructor ( message: string )
    {
        super( message );
        this.name = 'OrderControlUnavailableError';
    }
}
