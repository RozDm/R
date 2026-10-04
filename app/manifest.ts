import type { MetadataRoute } from 'next'
import { AUTHOR, SITE_URL, THEME_BG } from '@/lib/site'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: AUTHOR.name,
    short_name: 'rozsoshnykh',
    description: `${AUTHOR.roles.join(' · ')} i Vestland.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: THEME_BG.dark,
    theme_color: THEME_BG.dark,
    lang: 'nb-NO',
    icons: [
      {
        src: `${SITE_URL}/icon.svg`,
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      // PNGs from app/icons/[name]/route.tsx — install prompts want raster
      // 192/512; the eye sits inside the safe zone, so they double as maskable.
      { src: `${SITE_URL}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${SITE_URL}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${SITE_URL}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
