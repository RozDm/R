import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { normalizeTags } from './tags'
import { readingTimeMinutes } from './reading-time'
import type { Post, PostMeta } from '@/types'

const BLOG_DIR = path.join(process.cwd(), 'content/blog')

export function getPostSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return []
  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''))
}

export function getPostBySlug(slug: string): Post {
  const fullPath = path.join(BLOG_DIR, `${slug}.md`)
  const raw = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(raw)
  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? '',
    date: data.date ?? '',
    tags: normalizeTags(data.tags),
    readingMinutes: readingTimeMinutes(content),
    content,
  }
}

export function getAllPosts(): PostMeta[] {
  return getPostSlugs()
    .map((slug) => {
      const { content: _content, ...meta } = getPostBySlug(slug)
      return meta
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
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
