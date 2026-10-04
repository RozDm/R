import { describe, expect, it } from 'vitest'
import { RSS_ALTERNATE, pageMetadata } from '@/lib/metadata'
import { SITE_URL } from '@/lib/site'

// Next merges route metadata shallowly, so every page must carry the whole
// set itself. These pin the invariants that used to break page by page.
describe('pageMetadata', () => {
  const kontakt = pageMetadata({
    title: 'Kontakt',
    description: 'Send meg en melding.',
    path: '/kontakt/',
    noindex: true,
  })

  it('points canonical and og:url at the same page URL', () => {
    expect(kontakt.alternates?.canonical).toBe(`${SITE_URL}/kontakt/`)
    expect(kontakt.openGraph?.url).toBe(`${SITE_URL}/kontakt/`)
  })

  it('always keeps the RSS alternate link', () => {
    expect(kontakt.alternates?.types).toEqual(RSS_ALTERNATE)
  })

  it('carries site name, its own og:title and the default card image', () => {
    expect(kontakt.openGraph?.siteName).toBeTruthy()
    expect(kontakt.openGraph?.title).toMatch(/^Kontakt – /)
    expect(kontakt.openGraph?.images).toBeDefined()
  })

  it('marks utility pages noindex, leaves others to the layout', () => {
    expect(kontakt.robots).toEqual({ index: false, follow: true })
    expect(pageMetadata({ title: 'Blogg', description: 'x', path: '/blogg/' }).robots).toBeUndefined()
  })

  it('leaves og:image to the route file when the page has its own', () => {
    const post = pageMetadata({
      title: 'Post',
      description: 'x',
      path: '/blogg/post/',
      ogTitle: 'Post',
      ownImage: true,
      article: { publishedTime: '2026-06-05', tags: ['Linux'] },
    })
    expect(post.openGraph?.images).toBeUndefined()
    expect(post.openGraph).toMatchObject({ type: 'article', title: 'Post', publishedTime: '2026-06-05' })
  })

  it('supports an absolute title for the home page', () => {
    const home = pageMetadata({ title: 'Hjem', description: 'x', path: '/', absoluteTitle: true })
    expect(home.title).toEqual({ absolute: 'Hjem' })
    expect(home.openGraph?.title).toBe('Hjem')
  })
})
