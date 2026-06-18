import { describe, expect, it, vi } from 'vitest'
import { getAllPosts, getAdjacentPosts, getPostsByTag, getAllTags } from '@/lib/blog'

// lib/blog reads markdown off disk; mock node:fs so these tests exercise the
// ordering / adjacency / tag logic against a fixed set, independent of whatever
// lives in content/blog. Fixtures and impl live inside the factory because
// vi.mock is hoisted above module scope and can't close over outer variables.
vi.mock('node:fs', () => {
  const POSTS: Record<string, string> = {
    eldst: `---
title: "Eldst"
description: "Den eldste."
date: "2026-01-01"
tags: ["Linux"]
---
Eldste post.`,
    midt: `---
title: "Midt"
description: "Midt i mellom."
date: "2026-03-01"
tags: ["Linux", "Docker"]
---
Midterste post.`,
    // Tag stored lower-case on purpose: normalizeTags must canonicalise it to
    // "Docker" so a lower-case query still finds this post.
    nyest: `---
title: "Nyest"
description: "Den nyeste."
date: "2026-06-01"
tags: ["docker"]
---
Nyeste post.`,
  }
  return {
    default: {
      existsSync: () => true,
      readdirSync: () => Object.keys(POSTS).map((slug) => `${slug}.md`),
      readFileSync: (file: string) => POSTS[String(file).replace(/.*\//, '').replace(/\.md$/, '')],
    },
  }
})

describe('getAllPosts', () => {
  it('sorts newest-first by date', () => {
    expect(getAllPosts().map((p) => p.slug)).toEqual(['nyest', 'midt', 'eldst'])
  })
})

describe('getAdjacentPosts', () => {
  it('prev is older, next is newer', () => {
    const { prev, next } = getAdjacentPosts('midt')
    expect(prev?.slug).toBe('eldst')
    expect(next?.slug).toBe('nyest')
  })

  it('newest post has no next', () => {
    const { prev, next } = getAdjacentPosts('nyest')
    expect(prev?.slug).toBe('midt')
    expect(next).toBeNull()
  })

  it('oldest post has no prev', () => {
    const { prev, next } = getAdjacentPosts('eldst')
    expect(prev).toBeNull()
    expect(next?.slug).toBe('midt')
  })

  it('returns nulls for an unknown slug', () => {
    expect(getAdjacentPosts('finnes-ikke')).toEqual({ prev: null, next: null })
  })
})

describe('getPostsByTag', () => {
  it('matches case-insensitively and after tag normalisation', () => {
    expect(getPostsByTag('docker').map((p) => p.slug)).toEqual(['nyest', 'midt'])
  })

  it('returns an empty list for a tag no post uses', () => {
    expect(getPostsByTag('windows server')).toEqual([])
  })
})

describe('getAllTags', () => {
  it('returns distinct tags sorted nb-NO', () => {
    expect(getAllTags()).toEqual(['Docker', 'Linux'])
  })
})
