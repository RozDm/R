import type { MetadataRoute } from 'next'
import { AUTHOR, SITE_URL } from '@/lib/site'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: AUTHOR.name,
    short_name: 'rozsoshnykh',
    description: 'Systemadministrator / DevOps i Vestland.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#030712',
    theme_color: '#0f172a',
    lang: 'nb-NO',
    icons: [
      {
        src: `${SITE_URL}/icon.svg`,
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
