import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HOOMA — shared living, in harmony',
    short_name: 'HOOMA',
    description:
      'Fair chore rotation, photo-flagged messes, and a single Harmony Score for your shared home.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbf7f0',
    theme_color: '#4d6e51',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
