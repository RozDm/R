import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { getPostBySlug, getPostSlugs } from '@/lib/blog'
import { SITE_URL } from '@/lib/site'
import type { Lang } from '@/lib/i18n'

// Runs against the real content/blog/, drafts included (vitest isn't a
// production build). Reading a post checks its frontmatter
// (lib/post-frontmatter.ts); this adds what the page around the text needs.

type Node = { type: string; depth?: number; url?: string; value?: string; children?: Node[] }

function walk(node: Node, visit: (n: Node) => void) {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

const text = (node: Node): string => node.value ?? (node.children ?? []).map(text).join('')

const posts = (['nb', 'en'] as const).flatMap((lang) =>
  getPostSlugs(lang).map((slug) => [lang === 'nb' ? `content/blog/${slug}.md` : `content/blog/en/${slug}.md`, lang, slug] as const),
)

function body(lang: Lang, slug: string): Node {
  return unified().use(remarkParse).use(remarkGfm).parse(getPostBySlug(slug, lang).content) as Node
}

describe('blog posts', () => {
  // Reading throws an error that names every problem (a matcher would cut it short).
  it.each(posts)('%s has valid frontmatter', (_, lang, slug) => {
    getPostBySlug(slug, lang)
  })

  // The page shows the title as the h1, so the text starts at ## and, like
  // any outline, goes down one level at a time (axe: heading-order).
  it.each(posts)('%s has text, with headings from ## down one level at a time', (_, lang, slug) => {
    const tree = body(lang, slug)
    expect(text(tree).trim(), 'the post has no text').not.toBe('')
    const wrong: string[] = []
    let prev = 1
    walk(tree, (n) => {
      if (n.type !== 'heading') return
      const d = n.depth!
      if (d === 1) wrong.push(`# ${text(n)}: the title is the page's h1, start at ##`)
      else if (d > prev + 1) wrong.push(`${'#'.repeat(d)} ${text(n)}: skips from h${prev} to h${d}`)
      prev = d
    })
    expect(wrong).toEqual([])
  })

  // A link to another post must lead somewhere: to a post that exists and,
  // from a published post, to a published one (a draft is a 404 in
  // production).
  it.each(posts)('%s links only to posts a reader can open', (_, lang, slug) => {
    const draft = getPostBySlug(slug, lang).draft
    const broken: string[] = []
    walk(body(lang, slug), (n) => {
      if ((n.type !== 'link' && n.type !== 'definition') || !n.url) return
      const url = n.url.startsWith(SITE_URL) ? n.url.slice(SITE_URL.length) : n.url
      const m = /^\/(blogg|en\/blog)\/([a-z0-9-]+)\/?(?:#.*)?$/.exec(url)
      if (!m) return
      const target: Lang = m[1] === 'blogg' ? 'nb' : 'en'
      if (!getPostSlugs(target).includes(m[2])) broken.push(`${n.url}: no such post`)
      else if (!draft && getPostBySlug(m[2], target).draft) broken.push(`${n.url}: a draft`)
    })
    expect(broken).toEqual([])
  })
})
