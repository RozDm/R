import { SITE_CARD_SIZE, siteCardAlt, siteCardImage } from '@/lib/og-site-card'

export const dynamic = 'force-static'
export const alt = siteCardAlt('en')
export const size = SITE_CARD_SIZE
export const contentType = 'image/png'

export default function Image() {
  return siteCardImage('en')
}
