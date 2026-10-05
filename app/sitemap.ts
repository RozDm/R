import type { MetadataRoute } from 'next'
import { getAllPosts, getAllTags, getPostsByTag } from '@/lib/blog'
import { tagToSlug } from '@/lib/tags'
import { SITE_URL } from '@/lib/site'
import { languageAlternates } from '@/lib/i18n'

export const dynamic = 'force-static'

// lastmod is only emitted where it is TRUE: a post's date, and for the
// list/tag pages the newest post they show. The home page changes with every
// deploy (skills, status, charts), so it gets no lastmod at all — a frozen
// fake date there was worse than none (Google learns to ignore a site's
// lastmod once it proves unreliable).
function newest(posts: { date: string }[]): Date | undefined {
  const dates = posts.filter((p) => p.date).map((p) => new Date(p.date).getTime())
  return dates.length ? new Date(Math.max(...dates)) : undefined
}

// hreflang pairs as absolute URLs (sitemap <xhtml:link> entries).
function alternates(path: string) {
  const langs = languageAlternates(path)
  return langs
    ? { languages: Object.fromEntries(Object.entries(langs).map(([k, p]) => [k, `${SITE_URL}${p}`])) }
    : undefined
}

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts()

  // /kontakt, /personvern and their /en/ twins are intentionally excluded —
  // they're noindex, and a sitemap must not list URLs we tell crawlers not to
  // index. The blog is Norwegian-only: no alternates there.
  return [
    { url: `${SITE_URL}/`, alternates: alternates('/') },
    { url: `${SITE_URL}/en/`, alternates: alternates('/en/') },
    { url: `${SITE_URL}/blogg/`, lastModified: newest(posts) },
    ...posts.map((post) => ({
      url: `${SITE_URL}/blogg/${post.slug}/`,
      lastModified: post.date ? new Date(post.updated && post.updated > post.date ? post.updated : post.date) : undefined,
    })),
    ...getAllTags().map((tag) => ({
      url: `${SITE_URL}/blogg/tag/${tagToSlug(tag)}/`,
      lastModified: newest(getPostsByTag(tag)),
    })),
  ]
}
