import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog'
import { SITE_URL } from '@/lib/site'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts().map((post) => ({
    url: `${SITE_URL}/blogg/${post.slug}/`,
    lastModified: post.date ? new Date(post.date) : new Date(),
  }))

  return [
    { url: `${SITE_URL}/`, lastModified: new Date() },
    { url: `${SITE_URL}/blogg/`, lastModified: new Date() },
    ...posts,
  ]
}
