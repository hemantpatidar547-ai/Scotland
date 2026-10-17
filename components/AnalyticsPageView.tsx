'use client';

import { useEffect } from 'react';
import { trackAnalyticsEvent } from '@/lib/analytics';

export function AnalyticsPageView ( { listName }: { listName: string } )
{
    useEffect( () =>
    {
        trackAnalyticsEvent( 'view_item_list', { item_list_name: listName } );
    }, [ listName ] );
    return null;
}
