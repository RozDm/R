import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { normalizeTags } from './tags'
import { readingTimeMinutes } from './reading-time'
import type { Post, PostMeta } from '@/types'

const BLOG_DIR = path.join(process.cwd(), 'content/blog')

// Drafts surface in dev so the author has live preview, then disappear at
// build time. NODE_ENV is set by Next: 'development' under `npm run dev`,
// 'production' under `npm run build`. Centralised so every consumer
// (slug routing, list, sitemap, RSS, tags, adjacent posts) inherits the
// same rule via the two getters below.
const SHOW_DRAFTS = process.env.NODE_ENV !== 'production'

// Pure filter so it can be unit-tested without touching the filesystem.
// `includeDrafts: false` is the production safety net — exhaustive across
// every surface that lists posts.
export function filterPublished<T extends { draft?: boolean }>(
  posts: T[],
  { includeDrafts }: { includeDrafts: boolean },
): T[] {
  if (includeDrafts) return posts
  return posts.filter((p) => !p.draft)
}

function readPostFile(slug: string): Post {
  const fullPath = path.join(BLOG_DIR, `${slug}.md`)
  const raw = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(raw)
  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? '',
    date: data.date ?? '',
    updated: data.updated || undefined,
    draft: data.draft === true,
    tags: normalizeTags(data.tags),
    readingMinutes: readingTimeMinutes(content),
    content,
  }
}

// getPostSlugs is the chokepoint Next uses through generateStaticParams —
// a draft slug filtered here is never built into the static export, so
// the URL 404s in production with no extra guard in the page component.
export function getPostSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return []
  const all = fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''))
  if (SHOW_DRAFTS) return all
  return all.filter((slug) => !readPostFile(slug).draft)
}

export function getPostBySlug(slug: string): Post {
  return readPostFile(slug)
}

export function getAllPosts(): PostMeta[] {
  const all = getPostSlugs()
    .map((slug) => {
      const { content: _content, ...meta } = readPostFile(slug)
      return meta
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  return filterPublished(all, { includeDrafts: SHOW_DRAFTS })
}

// All distinct tags across posts, sorted, for static tag pages.
export function getAllTags(): string[] {
  return Array.from(new Set(getAllPosts().flatMap((p) => p.tags))).sort((a, b) =>
    a.localeCompare(b, 'nb-NO'),
  )
}

export function getPostsByTag(tag: string): PostMeta[] {
  const key = tag.toLowerCase()
  return getAllPosts().filter((p) => p.tags.some((t) => t.toLowerCase() === key))
}

// Posts are sorted newest-first; "previous" is older, "next" is newer.
export function getAdjacentPosts(slug: string): { prev: PostMeta | null; next: PostMeta | null } {
  const posts = getAllPosts()
  const i = posts.findIndex((p) => p.slug === slug)
  if (i === -1) return { prev: null, next: null }
  return {
    prev: posts[i + 1] ?? null,
    next: posts[i - 1] ?? null,
  }
}

export function formatDate(date: string): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long' }).format(new Date(date))
}
