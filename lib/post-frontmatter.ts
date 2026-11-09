import { STANDARD_TAGS } from '@/data/tags'
import { normalizeTag } from './tags'
import type { Lang } from './i18n'

// A post's frontmatter, checked as lib/blog.ts reads the file: a slip stops
// `npm run dev`, `npm test` and the build instead of going live quietly.
// Unchecked, `draft: "true"`, `draft: yes` or a misspelt `draft` published a
// draft, a tag outside the canon made a new tag page, and a post without a
// date dropped out of RSS.

export interface Frontmatter {
  title: string
  description: string
  date: string
  updated?: string
  tags: string[]
  draft: boolean
  translationOf?: string
}

const FIELDS = ['title', 'description', 'date', 'updated', 'tags', 'draft', 'translationOf']

// Search results cut a description at about 160 characters; under 50 says
// too little for a result or a link preview.
export const DESCRIPTION_LENGTH = { min: 50, max: 160 }

const show = (v: unknown): string => (v instanceof Date ? v.toISOString() : (JSON.stringify(v) ?? 'nothing'))

// "YYYY-MM-DD" naming a real day (Date would roll 2026-02-30 over to March).
// Unquoted, YAML hands over a Date at UTC midnight, which reads back as the
// same day.
function isoDay(v: unknown): string | null {
  const s = v instanceof Date && !Number.isNaN(v.getTime()) ? v.toISOString().replace(/T00:00:00\.000Z$/, '') : v
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const day = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(s) ? s : null
}

// Throws one error listing every problem, prefixed with the file.
export function parseFrontmatter(data: Record<string, unknown>, lang: Lang, file: string): Frontmatter {
  const problems: string[] = []

  for (const key of Object.keys(data)) {
    if (!FIELDS.includes(key)) problems.push(`unknown field «${key}» (the fields: ${FIELDS.join(', ')})`)
  }

  const text = (key: 'title' | 'description'): string => {
    const v = data[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
    problems.push(`${key}: required text (got ${show(v)})`)
    return ''
  }
  const title = text('title')
  const description = text('description')
  const { min, max } = DESCRIPTION_LENGTH
  if (description && (description.length < min || description.length > max)) {
    problems.push(`description: ${description.length} characters, keep it within ${min}–${max}`)
  }

  const date = isoDay(data.date)
  if (!date) problems.push(`date: required, "YYYY-MM-DD" (got ${show(data.date)})`)
  let updated: string | undefined
  if (data.updated != null && data.updated !== '') {
    updated = isoDay(data.updated) ?? undefined
    if (!updated) problems.push(`updated: "YYYY-MM-DD" (got ${show(data.updated)})`)
    else if (date && updated < date) problems.push(`updated (${updated}) is before date (${date})`)
  }

  if (data.draft !== undefined && typeof data.draft !== 'boolean') {
    problems.push(`draft: true or false, without quotes (got ${show(data.draft)})`)
  }

  const tags: string[] = []
  if (!Array.isArray(data.tags) || data.tags.length === 0) {
    problems.push(`tags: a list of at least one tag, like ["Linux", "Docker"] (got ${show(data.tags)})`)
  } else {
    for (const raw of data.tags) {
      const tag = typeof raw === 'string' ? normalizeTag(raw) : ''
      if (!(STANDARD_TAGS as readonly string[]).includes(tag)) {
        problems.push(`tags: ${show(raw)} is not in STANDARD_TAGS or TAG_ALIASES (data/tags.ts)`)
      } else if (!tags.includes(tag)) tags.push(tag)
    }
  }

  let translationOf: string | undefined
  if (data.translationOf !== undefined) {
    if (lang !== 'en') problems.push('translationOf: only an English post (content/blog/en/) names its Norwegian twin')
    else if (typeof data.translationOf === 'string' && data.translationOf.trim()) translationOf = data.translationOf.trim()
    else problems.push(`translationOf: the Norwegian twin's slug (got ${show(data.translationOf)})`)
  }

  if (problems.length) throw new Error(`${file}: ${problems.join('; ')}`)
  return { title, description, date: date!, updated, tags, draft: data.draft === true, translationOf }
}
