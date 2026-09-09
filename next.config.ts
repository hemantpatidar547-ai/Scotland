import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: { remotePatterns: [ { protocol: 'https', hostname: 'images.unsplash.com' } ] },
  async rewrites ()
  {
    return [
      {
        source: '/assests/:path*',
        destination: '/api/assests/:path*',
      },
    ];
  },
};
export default nextConfig;
