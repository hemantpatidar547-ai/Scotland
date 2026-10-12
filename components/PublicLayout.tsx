'use client';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export function PublicLayout ( { children }: { children: React.ReactNode } )
{
    const pathname = usePathname();
    const isAdmin = pathname?.startsWith( '/admin' );

    if ( isAdmin )
    {
        return <>{ children }</>;
    }

    return (
        <>
            <Header />
            { children }
            <Footer />
        </>
    );
}
