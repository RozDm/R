import type { Metadata } from 'next'
import { AUTHOR, SITE_CARD_SIZE, SITE_URL, siteCardAlt } from './site'
import { OG_LOCALE, languageAlternates, pick, type Lang } from './i18n'
import { certifications } from '@/data/certifications'
import { skillGroups } from '@/data/skills'

// Next merges route metadata SHALLOWLY: a page that sets `openGraph` or
// `alternates` replaces the parent's object wholesale instead of extending
// it. Pages that set only some of it silently lost the rest — /kontakt and
// the tag pages inherited the home page's og:url and og:title, /blogg/ lost
// og:image, and every page that set a canonical dropped the RSS
// <link rel="alternate">. Every page builds its metadata here so canonical,
// og:url, og:site_name, og:image and the feed link always travel together.

export const RSS_ALTERNATE = { 'application/rss+xml': '/feed.xml' }
const RSS_ALTERNATE_EN = { 'application/rss+xml': '/en/feed.xml' }

// The site-wide card rendered by app/opengraph-image.tsx (/en/: the English
// one). Pages with their own opengraph-image file (home, blog posts) pass
// `ownImage` so the file convention supplies it instead.
function defaultOgImage(lang: Lang) {
  return {
    url: lang === 'en' ? '/en/opengraph-image' : '/opengraph-image',
    ...SITE_CARD_SIZE,
    alt: siteCardAlt(lang),
  }
}

export interface PageMetadataInput {
  // Page language (default 'nb'). Pages that exist in both languages get
  // hreflang alternates automatically (lib/i18n.ts pairs).
  lang?: Lang
  title: string
  description: string
  // Canonical path with the trailing slash the static export uses ('/kontakt/').
  path: string
  // true: use `title` verbatim instead of the layout's "%s – Name" template.
  absoluteTitle?: boolean
  ogTitle?: string
  ogDescription?: string
  // noindex: utility pages for good (/kontakt, /personvern), topic pages
  // until the owner lists them (data/tags.ts INDEXED_TAGS).
  noindex?: boolean
  // The route has its own opengraph-image file.
  ownImage?: boolean
  // hreflang pairs for pages that pair dynamically (blog posts and tags),
  // as paths; static pairs come from lib/i18n.ts automatically.
  languages?: Record<string, string>
  article?: { publishedTime: string; modifiedTime?: string; tags: string[] }
}

export function pageMetadata(input: PageMetadataInput): Metadata {
  const lang = input.lang ?? 'nb'
  const url = `${SITE_URL}${input.path}`
  const languages = input.languages ?? languageAlternates(input.path)
  const og = {
    title: input.ogTitle ?? (input.absoluteTitle ? input.title : `${input.title} – ${AUTHOR.name}`),
    description: input.ogDescription ?? input.description,
    url,
    siteName: AUTHOR.name,
    locale: OG_LOCALE[lang],
    ...(languages ? { alternateLocale: [OG_LOCALE[lang === 'nb' ? 'en' : 'nb']] } : {}),
    ...(input.ownImage ? {} : { images: [defaultOgImage(lang)] }),
  }
  const openGraph: Metadata['openGraph'] = input.article
    ? {
        ...og,
        type: 'article',
        publishedTime: input.article.publishedTime,
        ...(input.article.modifiedTime ? { modifiedTime: input.article.modifiedTime } : {}),
        authors: [AUTHOR.name],
        tags: input.article.tags,
      }
    : { ...og, type: 'website' }

  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: {
      canonical: url,
      ...(languages ? { languages } : {}),
      // Each language advertises its own blog feed.
      types: lang === 'en' ? RSS_ALTERNATE_EN : RSS_ALTERNATE,
    },
    openGraph,
    ...(input.noindex ? { robots: { index: false, follow: true } } : {}),
  }
}

// The sitewide Person (app/layout.tsx). knowsAbout lists the skills the site
// claims (not the "learning" group); hasCredential the certificates, so a
// search engine reads the same CV the page shows. Norwegian names: the
// site's default language.
export function personJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: AUTHOR.name,
    jobTitle: AUTHOR.jobTitle,
    url: SITE_URL,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Askøy',
      addressRegion: 'Vestland',
      addressCountry: 'NO',
    },
    sameAs: AUTHOR.sameAs,
    knowsAbout: skillGroups.filter((g) => !g.learning).flatMap((g) => g.items.map((i) => pick('nb', i))),
    hasCredential: certifications.map((c) => ({
      '@type': 'EducationalOccupationalCredential',
      name: pick('nb', c.title),
      credentialCategory: 'certificate',
      recognizedBy: { '@type': 'Organization', name: pick('nb', c.issuer) },
      ...(c.url ? { url: c.url } : {}),
    })),
  }
}

// JSON-LD for a <script type="application/ld+json">. JSON.stringify leaves
// `<` alone, so a value holding "</script>" would end the element early and
// whatever follows would run as markup — and the page's hash CSP admits every
// inline script that ships in the built HTML. Frontmatter only comes from the
// repo, so this is belt and braces: < is the same character to JSON.
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
