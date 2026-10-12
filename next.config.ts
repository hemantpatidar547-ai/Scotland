import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  experimental: { devtoolSegmentExplorer: false },
  images: { remotePatterns: [ { protocol: 'https', hostname: 'images.unsplash.com' } ] },
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
