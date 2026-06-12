import { describe, expect, it } from 'vitest'
import { countriesFromRows, isCountableCountry, isHumanNavigation, isValidSlug, looksLikeBot } from '@/src/metrics'

describe('isValidSlug', () => {
  it('accepts normal slugs', () => {
    expect(isValidSlug('velkommen')).toBe(true)
    expect(isValidSlug('proxmox-til-hyper-v-2')).toBe(true)
  })

  it('rejects traversal, casing and garbage', () => {
    expect(isValidSlug('../etc/passwd')).toBe(false)
    expect(isValidSlug('UPPER')).toBe(false)
    expect(isValidSlug('')).toBe(false)
    expect(isValidSlug('-leading')).toBe(false)
    expect(isValidSlug('a'.repeat(65))).toBe(false)
  })
})

describe('isCountableCountry', () => {
  it('accepts real ISO alpha-2 codes', () => {
    expect(isCountableCountry('NO')).toBe(true)
    expect(isCountableCountry('UA')).toBe(true)
  })

  it('rejects reserved codes, lowercase and garbage', () => {
    expect(isCountableCountry('XX')).toBe(false)
    expect(isCountableCountry('T1')).toBe(false)
    expect(isCountableCountry('no')).toBe(false)
    expect(isCountableCountry('TOOLONG')).toBe(false)
    expect(isCountableCountry(undefined)).toBe(false)
  })
})

describe('countriesFromRows', () => {
  it('builds the API shape from D1 rows', () => {
    expect(
      countriesFromRows([
        { country: 'NO', count: 81 },
        { country: 'US', count: 30 },
      ]),
    ).toEqual({ NO: 81, US: 30 })
  })

  it('drops invalid codes and non-positive counts', () => {
    expect(
      countriesFromRows([
        { country: 'XX', count: 5 },
        { country: 'NO', count: 0 },
        { country: 'SE', count: 2.9 },
      ]),
    ).toEqual({ SE: 2 })
  })
})

describe('looksLikeBot', () => {
  it('flags crawlers, tooling and missing UA', () => {
    expect(looksLikeBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true)
    expect(looksLikeBot('curl/8.5.0')).toBe(true)
    expect(looksLikeBot('smoke-test/1.0 (+https://rozsoshnykh.no)')).toBe(true)
    expect(looksLikeBot(null)).toBe(true)
  })

  it('passes normal browsers', () => {
    expect(looksLikeBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36')).toBe(false)
  })
})

describe('isHumanNavigation', () => {
  const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'

  it('accepts a browser page load', () => {
    const h = new Headers({ 'user-agent': chrome, 'sec-fetch-mode': 'navigate' })
    expect(isHumanNavigation(h)).toBe(true)
  })

  it('rejects scanners with browser UA but no sec-fetch headers', () => {
    const h = new Headers({ 'user-agent': chrome })
    expect(isHumanNavigation(h)).toBe(false)
  })

  it('rejects subresource/cors fetches and bot UAs', () => {
    expect(isHumanNavigation(new Headers({ 'user-agent': chrome, 'sec-fetch-mode': 'cors' }))).toBe(false)
    expect(isHumanNavigation(new Headers({ 'user-agent': 'Googlebot/2.1', 'sec-fetch-mode': 'navigate' }))).toBe(false)
  })
})
