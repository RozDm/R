import fs from 'node:fs'
import path from 'node:path'

// Sample posts for the browser tests, read from the build they run against
// (out/): the newest post of the Norwegian feed, one of its tag pages, and a
// Norwegian post with an English twin, found through the pages' own links.
// No test names a post, so any post can come, go or change its slug.

const OUT = path.resolve(__dirname, '..', 'out')
const read = (file: string) => fs.readFileSync(path.join(OUT, file), 'utf8')
const page = (p: string) => read(path.join(p, 'index.html'))
const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

export interface SamplePost {
  path: string // /blogg/<slug>/
  slug: string // its view key too: a Norwegian post counts under its own slug
  title: string
}

// Newest first, as lib/feed.ts writes it.
const feed = [...read('feed.xml').matchAll(/<item>\s*<title>([^<]*)<\/title>\s*<link>https?:\/\/[^/<]+(\/[^<]*)<\/link>/g)].map(
  ([, title, p]): SamplePost => ({ path: p, slug: p.split('/').filter(Boolean).pop()!, title: unescapeXml(title) }),
)
if (!feed.length) throw new Error('out/feed.xml lists no post: the browser tests need one published Norwegian post')

export const post = feed[0]

const tag = /href="(\/blogg\/tag\/[a-z0-9-]+\/)"/.exec(page(post.path))?.[1]
if (!tag) throw new Error(`${post.path} links no tag page`)
export const tagPage = tag

// The first Norwegian post whose page names an English alternate, if any.
export const twin =
  feed
    .map((p) => ({ nb: p.path, en: /hrefLang="en" href="https?:\/\/[^/"]+(\/[^"]*)"/.exec(page(p.path))?.[1] }))
    .find((t): t is { nb: string; en: string } => !!t.en) ?? null

// A URL matcher for a page path (`toHaveURL` against the full URL).
export const endsWith = (p: string) => new RegExp(`${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
