import { STANDARD_TAGS, TAG_ALIASES, TAG_LABELS_EN } from '@/data/tags'
import type { Lang } from './i18n'

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
 * URL-safe slug for a tag, used in /blogg/tag/<slug>.
 * «CI/CD» → «ci-cd», «Node.js» → «node-js», «C++» → «c», «Overvåking» →
 * «overvaking» (æ/ø/å folded like post slugs, not dropped). Lossy, so always
 * resolve back by comparing slugs of known tags rather than reversing.
 */
export function tagToSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replaceAll('æ', 'ae')
    .replaceAll('ø', 'o')
    .replaceAll('å', 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// How a canonical tag reads in `lang`: the English blog shows English words
// for the Norwegian-word tags (data/tags.ts TAG_LABELS_EN).
export function tagLabel(tag: string, lang: Lang): string {
  return lang === 'en' ? (TAG_LABELS_EN[tag] ?? tag) : tag
}
