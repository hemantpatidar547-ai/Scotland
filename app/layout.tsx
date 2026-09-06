import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { StoreProvider } from '@/components/StoreProvider';

export const metadata: Metadata = { title: 'SCOTLAND — Modern clothing, rooted in Scotland', description: 'Premium Scottish-inspired fashion.' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body><StoreProvider><Header />{children}<Footer /></StoreProvider></body></html>; }
