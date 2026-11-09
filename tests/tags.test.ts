import { describe, expect, it } from 'vitest'
import { normalizeTag, tagLabel, tagToSlug } from '@/lib/tags'
import { INDEXED_TAGS, STANDARD_TAGS, TAG_ALIASES, TAG_LABELS_EN } from '@/data/tags'

describe('normalizeTag', () => {
  it('canonicalises a known tag with different casing', () => {
    expect(normalizeTag('devops')).toBe('DevOps')
    expect(normalizeTag('LINUX')).toBe('Linux')
  })

  it('resolves aliases', () => {
    expect(normalizeTag('k8s')).toBe('Kubernetes')
    expect(normalizeTag('nodejs')).toBe('Node.js')
    expect(normalizeTag('overvaking')).toBe('Overvåking')
  })

  it('capitalises unknown tags but preserves inner casing', () => {
    expect(normalizeTag('kunstig intelligens')).toBe('Kunstig intelligens')
  })

  it('returns empty string for blank input', () => {
    expect(normalizeTag('   ')).toBe('')
  })
})

describe('tagToSlug', () => {
  it('folds æ/ø/å the way post slugs do', () => {
    expect(tagToSlug('Overvåking')).toBe('overvaking')
    expect(tagToSlug('Ærlig Ødegård')).toBe('aerlig-odegard')
  })

  it('turns everything else outside a-z0-9 into single dashes', () => {
    expect(tagToSlug('CI/CD')).toBe('ci-cd')
    expect(tagToSlug('Node.js')).toBe('node-js')
  })
})

// The vocabulary in data/tags.ts holds together: post frontmatter may only
// use STANDARD_TAGS (lib/post-frontmatter.ts), so every alias, English label
// and indexed tag must lead to one of them, and no two tags may share a page.
describe('tag vocabulary', () => {
  const canon = STANDARD_TAGS as readonly string[]

  it('lists each tag once', () => {
    const keys = canon.map((t) => t.toLowerCase())
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([])
  })

  it('points every alias, English label and indexed tag at a standard tag', () => {
    const stray = [
      ...Object.values(TAG_ALIASES),
      ...Object.keys(TAG_LABELS_EN),
      ...INDEXED_TAGS,
    ].filter((t) => !canon.includes(t))
    expect(stray).toEqual([])
  })

  it('keys aliases in lower case (normalizeTag looks them up lower-cased)', () => {
    expect(Object.keys(TAG_ALIASES).filter((k) => k !== k.toLowerCase())).toEqual([])
  })

  it.each(['nb', 'en'] as const)('gives every tag its own %s page', (lang) => {
    const slugs = canon.map((t) => tagToSlug(tagLabel(t, lang)))
    expect(slugs.filter((s, i) => !s || slugs.indexOf(s) !== i)).toEqual([])
  })
})
