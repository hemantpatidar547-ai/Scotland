import type { Metadata } from 'next';
import './globals.css';
import { StoreProvider } from '@/components/StoreProvider';
import NextTopLoader from 'nextjs-toploader';
import { PublicLayout } from '@/components/PublicLayout';

export const metadata: Metadata = { title: 'SCOTLAND — Modern clothing, rooted in Scotland', description: 'Premium Scottish-inspired fashion.' };
export default function RootLayout ( { children }: Readonly<{ children: React.ReactNode }> ) { return <html lang="en" suppressHydrationWarning><body suppressHydrationWarning><NextTopLoader color="#1e3a8a" showSpinner={ false } shadow="0 0 10px #1e3a8a,0 0 5px #1e3a8a" /><StoreProvider><PublicLayout>{ children }</PublicLayout></StoreProvider></body></html>; }
