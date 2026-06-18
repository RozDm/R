import { STANDARD_TAGS, TAG_ALIASES } from '@/data/tags'

function capitalizeFirst(s: string): string {
  if (!s) return s
  return s[0].toLocaleUpperCase('nb-NO') + s.slice(1)
}

/**
 * Normaliserer ett tag-navn:
 *   1) Aliasoppslag (case-insensitivt)
 *   2) Sammenligning mot STANDARD_TAGS (case-insensitivt)
 *   3) Ukjent? Returneres trimmet med stor forbokstav («kunstig intelligens»
 *      → «Kunstig intelligens»). Resten av casing-en beholdes uendret slik at
 *      ord som «iOS» eller «macOS» ikke ødelegges.
 */
export function normalizeTag(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const key = trimmed.toLowerCase()

  if (TAG_ALIASES[key]) return TAG_ALIASES[key]

  const canonical = STANDARD_TAGS.find((t) => t.toLowerCase() === key)
  if (canonical) return canonical

  return capitalizeFirst(trimmed)
}

/**
 * Normaliserer en hel tag-liste (fra frontmatter) og fjerner duplikater
 * som oppstår etter normalisering (f.eks. ["devops", "DevOps"] → ["DevOps"]).
 */
export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of tags) {
    if (typeof raw !== 'string') continue
    const normalized = normalizeTag(raw)
    if (!normalized) continue
    const dedupeKey = normalized.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    result.push(normalized)
  }
  return result
}

/**
 * URL-safe slug for a tag, used in /blogg/tag/<slug>.
 * «CI/CD» → «ci-cd», «Node.js» → «node-js», «C++» → «c». Lossy, so always
 * resolve back by comparing slugs of known tags rather than reversing.
 */
export function tagToSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
