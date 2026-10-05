import type { Lang } from './i18n'
import { tagLabel, tagToSlug } from './tags'

// Blog URLs per language: /blogg/… (Norwegian), /en/blog/… (English). English
// tag URLs come from the English tag label (/en/blog/tag/security/).
export function blogPath(lang: Lang): string {
  return lang === 'en' ? '/en/blog/' : '/blogg/'
}

export function postPath(lang: Lang, slug: string): string {
  return `${blogPath(lang)}${slug}/`
}

export function tagPath(lang: Lang, tag: string): string {
  return `${blogPath(lang)}tag/${tagToSlug(tagLabel(tag, lang))}/`
}

export function feedPath(lang: Lang): string {
  return lang === 'en' ? '/en/feed.xml' : '/feed.xml'
}
