import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LifeOs',
    short_name: 'LifeOs',
    description: 'Особиста жива ОС: фокус, звички, здоровʼя, фінанси, цілі й календар.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0D0C0B',
    theme_color: '#FF5B1F',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
