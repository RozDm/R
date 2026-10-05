import { describe, expect, it } from 'vitest'
import { getPostBySlug, getPostSlugs } from '@/lib/blog'

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
