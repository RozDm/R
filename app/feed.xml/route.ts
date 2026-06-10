import { getAllPosts } from '@/lib/blog'
import { SITE_URL, AUTHOR } from '@/lib/site'

export const dynamic = 'force-static'

function escapeXml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export async function GET() {
  const posts = getAllPosts()
  const items = posts
    .map((post) => {
      const url = `${SITE_URL}/blogg/${post.slug}/`
      const pubDate = post.date ? `\n      <pubDate>${new Date(post.date).toUTCString()}</pubDate>` : ''
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>${pubDate}
      <description>${escapeXml(post.description)}</description>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(AUTHOR.name)} – Blogg</title>
    <link>${SITE_URL}/blogg/</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Artikler om systemadministrasjon, DevOps, infrastruktur, automatisering og sikkerhet.</description>
    <language>nb-NO</language>
${items}
  </channel>
</rss>
`
  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
