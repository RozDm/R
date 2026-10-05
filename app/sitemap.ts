import type { MetadataRoute } from 'next'
import { getAllPosts, getAllTags, getPostsByTag, getTranslation } from '@/lib/blog'
import { blogPath, postPath, tagPath } from '@/lib/blog-paths'
import { SITE_URL } from '@/lib/site'
import { languageAlternates, type Lang } from '@/lib/i18n'

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

// A post or tag page in both languages carries its hreflang pair.
function pairAlternates(nbPath: string | null, enPath: string | null) {
  return nbPath && enPath
    ? { languages: { nb: `${SITE_URL}${nbPath}`, en: `${SITE_URL}${enPath}`, 'x-default': `${SITE_URL}${nbPath}` } }
    : undefined
}

function blogEntries(lang: Lang): MetadataRoute.Sitemap {
  const posts = getAllPosts(lang)
  const twinLang: Lang = lang === 'nb' ? 'en' : 'nb'
  const twinTags = new Set(getAllTags(twinLang))
  return [
    { url: `${SITE_URL}${blogPath(lang)}`, lastModified: newest(posts), alternates: alternates(blogPath(lang)) },
    ...posts.map((post) => {
      const twin = getTranslation(post)
      const own = postPath(lang, post.slug)
      const other = twin ? postPath(twinLang, twin.slug) : null
      return {
        url: `${SITE_URL}${own}`,
        lastModified: post.date ? new Date(post.updated && post.updated > post.date ? post.updated : post.date) : undefined,
        alternates: lang === 'nb' ? pairAlternates(own, other) : pairAlternates(other, own),
      }
    }),
    ...getAllTags(lang).map((tag) => {
      const own = tagPath(lang, tag)
      const other = twinTags.has(tag) ? tagPath(twinLang, tag) : null
      return {
        url: `${SITE_URL}${own}`,
        lastModified: newest(getPostsByTag(tag, lang)),
        alternates: lang === 'nb' ? pairAlternates(own, other) : pairAlternates(other, own),
      }
    }),
  ]
}

export default function sitemap(): MetadataRoute.Sitemap {
  // /kontakt, /personvern and their /en/ twins are intentionally excluded —
  // they're noindex, and a sitemap must not list URLs we tell crawlers not to
  // index.
  return [
    { url: `${SITE_URL}/`, alternates: alternates('/') },
    { url: `${SITE_URL}/en/`, alternates: alternates('/en/') },
    ...blogEntries('nb'),
    ...blogEntries('en'),
  ]
}
