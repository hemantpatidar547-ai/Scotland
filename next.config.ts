import type { NextConfig } from 'next';

const supabaseImagePattern = ( () =>
{
  try
  {
    const url = new URL( process.env.NEXT_PUBLIC_SUPABASE_URL || '' );
    if ( url.protocol !== 'https:' && url.protocol !== 'http:' ) return undefined;
    return {
      protocol: url.protocol === 'http:' ? 'http' as const : 'https' as const,
      hostname: url.hostname,
      ...( url.port ? { port: url.port } : {} ),
      pathname: '/storage/v1/object/public/scotland-product-images/**',
    };
  } catch
  {
    return undefined;
  }
} )();

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  experimental: { devtoolSegmentExplorer: false },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      ...( supabaseImagePattern ? [ supabaseImagePattern ] : [] ),
    ],
  },
  webpack: ( config, { dev } ) =>
  {
    if ( dev ) config.cache = false;
    return config;
  },
  async rewrites ()
  {
    return [
      {
        source: '/assests/:path*',
        destination: '/images/new-arrivals/:path*',
      },
    ];
  },
};
export default nextConfig;
