import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MemoryScape',
    short_name: 'MemoryScape',
    description: 'A local-first personal memory and knowledge workspace.',
    start_url: '/capture',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f7f4',
    theme_color: '#f5f7f4',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
