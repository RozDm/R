import { describe, expect, it } from 'vitest'
import { getPostBySlug, getPostSlugs } from '@/lib/blog'
import { isValidSlug } from '@/src/metrics'

// Runs against the real content/blog/ (no fs mock): the two language versions
// of a post must not drift apart. A twin pair shares its date, revision date,
// tags and draft state; only the words differ.
const nbSlugs = getPostSlugs('nb')
const enPosts = getPostSlugs('en').map((slug) => getPostBySlug(slug, 'en'))
const paired = enPosts.filter((p) => p.translationOf)

describe('blog translations', () => {
  it.each(paired.map((p) => [p.slug, p] as const))('%s points at an existing Norwegian post', (_, en) => {
    expect(nbSlugs).toContain(en.translationOf)
  })

  it.each(paired.map((p) => [p.slug, p] as const))('%s matches its twin (date, updated, tags, draft)', (_, en) => {
    const nb = getPostBySlug(en.translationOf!, 'nb')
    expect({ date: en.date, updated: en.updated, tags: [...en.tags].sort(), draft: en.draft }).toEqual({
      date: nb.date,
      updated: nb.updated,
      tags: [...nb.tags].sort(),
      draft: nb.draft,
    })
  })

  it('pairs each Norwegian post at most once', () => {
    const targets = paired.map((p) => p.translationOf)
    expect(targets.length).toBe(new Set(targets).size)
  })

  it('gives English-only posts slugs no Norwegian post uses (the view counter is keyed by slug)', () => {
    const clashes = enPosts.filter((p) => !p.translationOf && nbSlugs.includes(p.slug)).map((p) => p.slug)
    expect(clashes).toEqual([])
  })
})

// A post's file name is its URL slug and its view key; drafts are included
// (vitest isn't a production build). The view counter 400s anything
// isValidSlug rejects, and the WAF rule (.github/waf/scanner-block.expr) is
// slug-safe only because slugs have no dot — `/blogg/install.sh/` could 403.
describe('blog slugs', () => {
  it('every content/blog post file name is a valid slug', () => {
    expect([...nbSlugs, ...getPostSlugs('en')].filter((slug) => !isValidSlug(slug))).toEqual([])
  })
})
