// Two languages: Norwegian at the root (the canonical site, every existing URL
// unchanged) and English under /en/. The blog stays Norwegian-only, so blog
// pages have no English counterpart. Strings live in data/i18n.ts.

export type Lang = 'nb' | 'en'

// Intl locale per language (dates, country names).
export const INTL_LOCALE: Record<Lang, string> = { nb: 'nb-NO', en: 'en-GB' }
// Open Graph og:locale.
export const OG_LOCALE: Record<Lang, string> = { nb: 'nb_NO', en: 'en_GB' }
// <html lang> / hreflang codes.
export const HREFLANG: Record<Lang, string> = { nb: 'nb', en: 'en' }

const EN_PREFIX = '/en'

export function langFromPath(pathname: string | null | undefined): Lang {
  if (!pathname) return 'nb'
  return pathname === EN_PREFIX || pathname.startsWith(`${EN_PREFIX}/`) ? 'en' : 'nb'
}

// Pages that exist in both languages, as [Norwegian path, English path].
// English paths get English slugs; everything else is Norwegian-only.
const PAIRS: readonly (readonly [string, string])[] = [
  ['/', '/en/'],
  ['/kontakt/', '/en/contact/'],
  ['/personvern/', '/en/privacy/'],
]

const withSlash = (p: string) => (p.endsWith('/') ? p : `${p}/`)

// The path of the Norwegian page `nbPath` in `lang` — for links inside a page
// (the contact button on /en/ must go to /en/contact/). Norwegian-only pages
// (the blog) stay as they are in both languages.
export function localePath(lang: Lang, nbPath: string): string {
  if (lang === 'nb') return nbPath
  const [base, hash] = nbPath.split('#')
  const pair = PAIRS.find(([nb]) => nb === withSlash(base))
  if (!pair) return nbPath
  return hash !== undefined ? `${pair[1]}#${hash}` : pair[1]
}

// Where the language switch on `pathname` leads: the same page in `target`,
// or that language's front page when the page exists in one language only.
export function switchPath(pathname: string, target: Lang): string {
  const here = withSlash(pathname)
  const pair = PAIRS.find(([nb, en]) => nb === here || en === here)
  if (pair) return target === 'nb' ? pair[0] : pair[1]
  return target === 'nb' ? '/' : `${EN_PREFIX}/`
}

// hreflang alternates for a page that exists in both languages (given either
// of its paths), or undefined for a one-language page. x-default points at
// Norwegian, the site's primary language.
export function languageAlternates(path: string): Record<string, string> | undefined {
  const pair = PAIRS.find(([nb, en]) => nb === path || en === path)
  if (!pair) return undefined
  return { [HREFLANG.nb]: pair[0], [HREFLANG.en]: pair[1], 'x-default': pair[0] }
}

// A string that differs per language (data files: skill groups, courses).
// Plain strings are language-neutral (product names like "Proxmox").
export type Localized = Record<Lang, string>

export function pick(lang: Lang, value: string | Localized): string {
  return typeof value === 'string' ? value : value[lang]
}
