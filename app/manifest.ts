import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Showdeck',
    short_name: 'Showdeck',
    description: 'The collaborative show planning workspace for podcast and radio teams.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/pwa-icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
