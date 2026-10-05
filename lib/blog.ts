import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { normalizeTags } from './tags'
import { readingTimeMinutes } from './reading-time'
import { INTL_LOCALE, type Lang } from './i18n'
import type { Post, PostMeta } from '@/types'

// Norwegian posts live in content/blog/, English ones in content/blog/en/. An
// English post names its Norwegian twin in `translationOf` (frontmatter);
// either language may also have posts with no twin.
const BLOG_DIRS: Record<Lang, string> = {
  nb: path.join(process.cwd(), 'content/blog'),
  en: path.join(process.cwd(), 'content/blog/en'),
}

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

function readPostFile(slug: string, lang: Lang): Post {
  const fullPath = path.join(BLOG_DIRS[lang], `${slug}.md`)
  const raw = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(raw)
  return {
    slug,
    lang,
    translationOf: lang === 'en' && typeof data.translationOf === 'string' ? data.translationOf : undefined,
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
export function getPostSlugs(lang: Lang = 'nb'): string[] {
  const dir = BLOG_DIRS[lang]
  if (!fs.existsSync(dir)) return []
  const all = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''))
  if (SHOW_DRAFTS) return all
  return all.filter((slug) => !readPostFile(slug, lang).draft)
}

export function getPostBySlug(slug: string, lang: Lang = 'nb'): Post {
  return readPostFile(slug, lang)
}

export function getAllPosts(lang: Lang = 'nb'): PostMeta[] {
  const all = getPostSlugs(lang)
    .map((slug) => {
      const { content: _content, ...meta } = readPostFile(slug, lang)
      return meta
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  return filterPublished(all, { includeDrafts: SHOW_DRAFTS })
}

// All distinct (canonical) tags across one language's posts, sorted, for
// static tag pages.
export function getAllTags(lang: Lang = 'nb'): string[] {
  return Array.from(new Set(getAllPosts(lang).flatMap((p) => p.tags))).sort((a, b) =>
    a.localeCompare(b, INTL_LOCALE[lang]),
  )
}

export function getPostsByTag(tag: string, lang: Lang = 'nb'): PostMeta[] {
  const key = tag.toLowerCase()
  return getAllPosts(lang).filter((p) => p.tags.some((t) => t.toLowerCase() === key))
}

// The published twin of a post in the other language, if there is one.
export function getTranslation(post: Pick<PostMeta, 'slug' | 'lang' | 'translationOf'>): PostMeta | null {
  if (post.lang === 'en') {
    if (!post.translationOf) return null
    return getAllPosts('nb').find((p) => p.slug === post.translationOf) ?? null
  }
  return getAllPosts('en').find((p) => p.translationOf === post.slug) ?? null
}

// One view counter per post across both languages: the Norwegian slug when
// the post has a Norwegian twin, its own slug otherwise.
export function viewKey(post: Pick<PostMeta, 'slug' | 'lang' | 'translationOf'>): string {
  return post.lang === 'en' && post.translationOf && getTranslation(post) ? post.translationOf : post.slug
}

// Posts are sorted newest-first; "previous" is older, "next" is newer —
// within one language.
export function getAdjacentPosts(
  slug: string,
  lang: Lang = 'nb',
): { prev: PostMeta | null; next: PostMeta | null } {
  const posts = getAllPosts(lang)
  const i = posts.findIndex((p) => p.slug === slug)
  if (i === -1) return { prev: null, next: null }
  return {
    prev: posts[i + 1] ?? null,
    next: posts[i - 1] ?? null,
  }
}

export function formatDate(date: string, lang: Lang = 'nb'): string {
  if (!date) return ''
  return new Intl.DateTimeFormat(INTL_LOCALE[lang], { dateStyle: 'long' }).format(new Date(date))
}
