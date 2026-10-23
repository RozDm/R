import { describe, expect, it } from 'vitest'
import { RSS_ALTERNATE, pageMetadata, personJsonLd, serializeJsonLd } from '@/lib/metadata'
import { certifications } from '@/data/certifications'
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

describe('serializeJsonLd', () => {
  it('escapes "<" so a value cannot close the <script> early, and stays the same JSON', () => {
    const data = { name: '</script><script>alert(1)</script>' }
    const out = serializeJsonLd(data)
    expect(out).not.toContain('<')
    expect(JSON.parse(out)).toEqual(data)
  })
})

describe('personJsonLd', () => {
  it('lists the claimed skills, not the ones still being learned', () => {
    const p = personJsonLd()
    expect(p.knowsAbout).toEqual(expect.arrayContaining(['Proxmox', 'Wazuh', 'Cloudflare Workers']))
    expect(p.knowsAbout).not.toContain('Terraform')
  })

  it('carries every certificate as a credential with its issuer', () => {
    const p = personJsonLd()
    expect(p.hasCredential).toHaveLength(certifications.length)
    expect(p.hasCredential[0]).toEqual({
      '@type': 'EducationalOccupationalCredential',
      name: 'CCNA Routing and Switching',
      credentialCategory: 'certificate',
      recognizedBy: { '@type': 'Organization', name: 'Cisco Networking Academy' },
    })
  })
})
