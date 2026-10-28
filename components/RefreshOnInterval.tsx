'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RefreshOnInterval ()
{
    const router = useRouter();

    useEffect( () =>
    {
        const refreshWhenVisible = () =>
        {
            if ( document.visibilityState === 'visible' ) router.refresh();
        };
        const interval = window.setInterval( refreshWhenVisible, 15000 );
        document.addEventListener( 'visibilitychange', refreshWhenVisible );
        return () =>
        {
            window.clearInterval( interval );
            document.removeEventListener( 'visibilitychange', refreshWhenVisible );
        };
    }, [ router ] );

    return null;
}
