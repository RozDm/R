import { getPostSlugs } from '@/lib/blog'
import { POST_CARD_SIZE, postCardAlt, postCardImage } from '@/lib/og-post-card'

export const dynamic = 'force-static'
export const alt = postCardAlt('en')
export const size = POST_CARD_SIZE
export const contentType = 'image/png'

export function generateStaticParams() {
  return getPostSlugs('en').map((slug) => ({ slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return postCardImage('en', (await params).slug)
}
