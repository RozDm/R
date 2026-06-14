import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog'
import { SITE_URL } from '@/lib/site'

export const dynamic = 'force-static'

// Fall back to a fixed launch date — not `new Date()` — so the home and
// /blogg/ entries don't change `lastmod` on every deploy (Google penalises
// noisy lastmod over time). Once posts exist, /blogg/ tracks the latest one.
const LAUNCH_DATE = new Date('2025-01-01')

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts()
  const latestPostDate = posts.reduce<Date>((acc, post) => {
    if (!post.date) return acc
    const d = new Date(post.date)
    return d > acc ? d : acc
  }, LAUNCH_DATE)

  // /kontakt is intentionally excluded — it's noindex, and a sitemap must
  // not list URLs we tell crawlers not to index (contradictory signal).
  return [
    { url: `${SITE_URL}/`, lastModified: LAUNCH_DATE },
    { url: `${SITE_URL}/blogg/`, lastModified: latestPostDate },
    ...posts.map((post) => ({
      url: `${SITE_URL}/blogg/${post.slug}/`,
      lastModified: post.date ? new Date(post.date) : LAUNCH_DATE,
    })),
  ]
}
