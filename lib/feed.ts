import { DICT } from '@/data/i18n'
import { getPostBySlug, getPostSlugs } from './blog'
import { blogPath, feedPath, postPath } from './blog-paths'
import { INTL_LOCALE, type Lang } from './i18n'
import { markdownToHtml } from './markdown'
import { AUTHOR, SITE_URL } from './site'

// RSS 2.0 feed for one language's blog: /feed.xml (Norwegian) and
// /en/feed.xml (English).

function escapeXml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

// Safely embed arbitrary HTML inside <![CDATA[ … ]]>. A literal `]]>` would
// close the section early and feed garbage to the parser; split it so neither
// half can match the terminator.
function cdataSafe(s: string): string {
  return s.replaceAll(']]>', ']]]]><![CDATA[>')
}

export async function blogFeed(lang: Lang): Promise<Response> {
  const t = DICT[lang].blog
  const posts = getPostSlugs(lang)
    .map((slug) => getPostBySlug(slug, lang))
    .filter((p) => p.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const items = await Promise.all(
    posts.map(async (post) => {
      const url = `${SITE_URL}${postPath(lang, post.slug)}`
      const html = await markdownToHtml(post.content)
      const updatedTag =
        post.updated && post.updated > post.date
          ? `\n      <atom:updated>${new Date(post.updated).toISOString()}</atom:updated>`
          : ''
      // Cross-post tools (Dev.to, Hashnode importers, n8n RSS fanouts) pick
      // up the canonical link from a rel="canonical" atom:link if it exists.
      // Without it they tend to omit canonical entirely and the duplicated
      // article on those platforms can outrank the original. <link> stays as
      // the permalink, RSS readers ignore the atom:link.
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <atom:link rel="canonical" href="${url}"/>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>${updatedTag}
      <description>${escapeXml(post.description)}</description>
      <content:encoded><![CDATA[${cdataSafe(html)}]]></content:encoded>
    </item>`
    }),
  )

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(AUTHOR.name)} – ${escapeXml(t.feedTitle)}</title>
    <link>${SITE_URL}${blogPath(lang)}</link>
    <atom:link href="${SITE_URL}${feedPath(lang)}" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(t.description)}</description>
    <language>${INTL_LOCALE[lang]}</language>
${items.join('\n')}
  </channel>
</rss>
`
  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
