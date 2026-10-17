import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { DICT } from '@/data/i18n'
import { ERROR_COPY } from '@/data/i18n-error'
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
    expect(localePath('en', '/blogg/')).toBe('/en/blog/')
  })
  it('leaves pages without a static twin and Norwegian links alone', () => {
    // Posts pair dynamically (their pages pass the twin), not through here.
    expect(localePath('en', '/blogg/velkommen/')).toBe('/blogg/velkommen/')
    expect(localePath('nb', '/kontakt/')).toBe('/kontakt/')
  })
})

describe('switchPath', () => {
  it('goes to the twin page', () => {
    expect(switchPath('/kontakt/', 'en')).toBe('/en/contact/')
    expect(switchPath('/en/privacy/', 'nb')).toBe('/personvern/')
    expect(switchPath('/en', 'nb')).toBe('/')
  })
  it('falls back to the front page when there is no static twin', () => {
    expect(switchPath('/blogg/velkommen/', 'en')).toBe('/en/')
    expect(switchPath('/blogg/', 'en')).toBe('/en/blog/')
  })
})

describe('languageAlternates', () => {
  it('pairs both directions, x-default Norwegian', () => {
    const both = { nb: '/', en: '/en/', 'x-default': '/' }
    expect(languageAlternates('/')).toEqual(both)
    expect(languageAlternates('/en/')).toEqual(both)
    expect(languageAlternates('/blogg/')).toEqual({ nb: '/blogg/', en: '/en/blog/', 'x-default': '/blogg/' })
    expect(languageAlternates('/blogg/velkommen/')).toBeUndefined()
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

  it('takes the error boundary copy from its one source, same keys in both languages', () => {
    expect(shape(ERROR_COPY.en)).toEqual(shape(ERROR_COPY.nb))
    for (const lang of ['nb', 'en'] as const) {
      expect(DICT[lang].backHome).toBe(ERROR_COPY[lang].backHome)
      expect(DICT[lang].error).toBe(ERROR_COPY[lang].error)
    }
  })

  it('keeps app/error.tsx off the full dictionary', () => {
    // error.tsx renders on every page: importing DICT put both languages in a
    // chunk every page loads.
    const from = [...readFileSync('app/error.tsx', 'utf8').matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1])
    expect(from.filter((s) => /data\/i18n$/.test(s))).toEqual([])
    expect(from).toContain('@/data/i18n-error')
  })

  it('picks a localized value or passes a neutral one through', () => {
    expect(pick('en', { nb: 'Nettverk', en: 'Networking' })).toBe('Networking')
    expect(pick('en', 'Proxmox')).toBe('Proxmox')
  })
})
