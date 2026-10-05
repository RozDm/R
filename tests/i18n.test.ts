import { describe, expect, it } from 'vitest'
import { DICT } from '@/data/i18n'
import { languageAlternates, langFromPath, localePath, pick, switchPath } from '@/lib/i18n'

describe('langFromPath', () => {
  it('reads English only under /en', () => {
    expect(langFromPath('/en')).toBe('en')
    expect(langFromPath('/en/')).toBe('en')
    expect(langFromPath('/en/contact/')).toBe('en')
    expect(langFromPath('/')).toBe('nb')
    expect(langFromPath('/blogg/velkommen/')).toBe('nb')
    expect(langFromPath('/enigma/')).toBe('nb')
    expect(langFromPath(null)).toBe('nb')
  })
})

describe('localePath', () => {
  it('maps paired pages and keeps the hash', () => {
    expect(localePath('en', '/')).toBe('/en/')
    expect(localePath('en', '/kontakt/')).toBe('/en/contact/')
    expect(localePath('en', '/personvern/')).toBe('/en/privacy/')
    expect(localePath('en', '/#skills')).toBe('/en/#skills')
  })
  it('leaves Norwegian-only pages and Norwegian links alone', () => {
    expect(localePath('en', '/blogg/')).toBe('/blogg/')
    expect(localePath('nb', '/kontakt/')).toBe('/kontakt/')
  })
})

describe('switchPath', () => {
  it('goes to the twin page', () => {
    expect(switchPath('/kontakt/', 'en')).toBe('/en/contact/')
    expect(switchPath('/en/privacy/', 'nb')).toBe('/personvern/')
    expect(switchPath('/en', 'nb')).toBe('/')
  })
  it('falls back to the front page when there is no twin (the blog)', () => {
    expect(switchPath('/blogg/velkommen/', 'en')).toBe('/en/')
  })
})

describe('languageAlternates', () => {
  it('pairs both directions, x-default Norwegian', () => {
    const both = { nb: '/', en: '/en/', 'x-default': '/' }
    expect(languageAlternates('/')).toEqual(both)
    expect(languageAlternates('/en/')).toEqual(both)
    expect(languageAlternates('/blogg/')).toBeUndefined()
  })
})

describe('dictionary', () => {
  // TypeScript enforces the shape; this guards against casts and empty strings.
  const shape = (v: unknown, path = ''): string[] =>
    v && typeof v === 'object'
      ? Object.entries(v).flatMap(([k, x]) => shape(x, `${path}.${k}`))
      : [`${path}:${typeof v}`]

  it('has the same keys and value kinds in both languages', () => {
    expect(shape(DICT.en)).toEqual(shape(DICT.nb))
  })

  it('has no empty English strings', () => {
    const strings = (v: unknown): string[] =>
      typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []
    expect(strings(DICT.en).filter((s) => !s.trim())).toEqual([])
  })

  it('picks a localized value or passes a neutral one through', () => {
    expect(pick('en', { nb: 'Nettverk', en: 'Networking' })).toBe('Networking')
    expect(pick('en', 'Proxmox')).toBe('Proxmox')
  })
})
