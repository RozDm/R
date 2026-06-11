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

export function formatDate(date: string): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long' }).format(new Date(date))
}
