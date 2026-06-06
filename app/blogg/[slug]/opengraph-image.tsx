import { ImageResponse } from 'next/og'
import { getPostBySlug, getPostSlugs } from '@/lib/blog'

export const dynamic = 'force-static'
export const alt = 'Artikkel — Dmytro Rozsoshnykh'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let title = 'Blogg'
  try {
    title = getPostBySlug(slug).title
  } catch {}

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#030712',
          padding: 80,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 90,
            height: 90,
            borderRadius: 9999,
            background: '#cc0000',
            boxShadow: '0 0 60px 20px rgba(220,0,0,0.35)',
          }}
        >
          <div style={{ width: 28, height: 28, borderRadius: 9999, background: '#ffd27f' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: '#f87171', fontSize: 24, letterSpacing: 4 }}>BLOGG</div>
          <div
            style={{
              color: '#ffffff',
              fontSize: title.length > 40 ? 60 : 76,
              fontWeight: 700,
              marginTop: 16,
              lineHeight: 1.1,
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ display: 'flex', color: '#475569', fontSize: 24 }}>
          Dmytro Rozsoshnykh · d.rozsoshnykh.workers.dev
        </div>
      </div>
    ),
    { ...size },
  )
}
