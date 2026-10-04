import type { Metadata } from 'next'
import { AUTHOR, SITE_URL } from './site'

// Next merges route metadata SHALLOWLY: a page that sets `openGraph` or
// `alternates` replaces the parent's object wholesale instead of extending
// it. Pages that set only some of it silently lost the rest — /kontakt and
// the tag pages inherited the home page's og:url and og:title, /blogg/ lost
// og:image, and every page that set a canonical dropped the RSS
// <link rel="alternate">. Every page builds its metadata here so canonical,
// og:url, og:site_name, og:image and the feed link always travel together.

export const RSS_ALTERNATE = { 'application/rss+xml': '/feed.xml' }

// The site-wide card rendered by app/opengraph-image.tsx. Pages with their
// own opengraph-image file (home, blog posts) pass `ownImage` so the file
// convention supplies it instead.
const DEFAULT_OG_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: `${AUTHOR.name} — ${AUTHOR.roles.join(' / ')}`,
}

export interface PageMetadataInput {
  title: string
  description: string
  // Canonical path with the trailing slash the static export uses ('/kontakt/').
  path: string
  // true: use `title` verbatim instead of the layout's "%s – Name" template.
  absoluteTitle?: boolean
  ogTitle?: string
  ogDescription?: string
  // Permanent noindex for utility pages (/kontakt, /personvern).
  noindex?: boolean
  // The route has its own opengraph-image file.
  ownImage?: boolean
  article?: { publishedTime: string; modifiedTime?: string; tags: string[] }
}

export function pageMetadata(input: PageMetadataInput): Metadata {
  const url = `${SITE_URL}${input.path}`
  const og = {
    title: input.ogTitle ?? (input.absoluteTitle ? input.title : `${input.title} – ${AUTHOR.name}`),
    description: input.ogDescription ?? input.description,
    url,
    siteName: AUTHOR.name,
    locale: 'nb_NO',
    ...(input.ownImage ? {} : { images: [DEFAULT_OG_IMAGE] }),
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
    alternates: { canonical: url, types: RSS_ALTERNATE },
    openGraph,
    ...(input.noindex ? { robots: { index: false, follow: true } } : {}),
  }
}
