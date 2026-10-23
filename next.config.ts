import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: { proxyClientMaxBodySize: '11mb' },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), geolocation=(self), microphone=()' },
      ],
    }];
  },
};

export default nextConfig;
