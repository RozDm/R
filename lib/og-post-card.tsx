import { ImageResponse } from 'next/og'
import { DICT } from '@/data/i18n'
import { getPostBySlug } from './blog'
import type { Lang } from './i18n'
import { AUTHOR } from './site'

// Social card for one blog post (HAL eye, BLOGG/BLOG label, title), rendered
// at build time by app/blogg/[slug]/opengraph-image.tsx and its /en/ twin.
export const POST_CARD_SIZE = { width: 1200, height: 630 }

export function postCardAlt(lang: Lang): string {
  return `${DICT[lang].blog.ogAlt} — ${AUTHOR.name}`
}

export function postCardImage(lang: Lang, slug: string): ImageResponse {
  let title = DICT[lang].blog.eyebrow
  try {
    title = getPostBySlug(slug, lang).title
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
          <div style={{ color: '#f87171', fontSize: 24, letterSpacing: 4 }}>{DICT[lang].blog.ogLabel}</div>
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
          {`${AUTHOR.name} · rozsoshnykh.no`}
        </div>
      </div>
    ),
    { ...POST_CARD_SIZE },
  )
}
