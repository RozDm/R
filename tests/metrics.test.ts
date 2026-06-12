import { describe, expect, it } from 'vitest'
import { bumpGeo, isHumanNavigation, isValidSlug, looksLikeBot, mergeGeo, parseCount, parseGeo } from '@/src/metrics'

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

describe('parseCount', () => {
  it('parses stored counters', () => {
    expect(parseCount('42')).toBe(42)
    expect(parseCount(null)).toBe(0)
  })

  it('never returns negative or NaN', () => {
    expect(parseCount('-5')).toBe(0)
    expect(parseCount('junk')).toBe(0)
  })
})

describe('parseGeo', () => {
  it('round-trips valid data', () => {
    const raw = JSON.stringify({ countries: { NO: 4, UA: 1 } })
    expect(parseGeo(raw)).toEqual({ countries: { NO: 4, UA: 1 } })
  })

  it('drops invalid codes and counts', () => {
    const raw = JSON.stringify({ countries: { NO: 2, xx: 3, TOOLONG: 1, DE: -1, FR: 'x' } })
    expect(parseGeo(raw)).toEqual({ countries: { NO: 2 } })
  })

  it('survives garbage', () => {
    expect(parseGeo('not json')).toEqual({ countries: {} })
    expect(parseGeo(null)).toEqual({ countries: {} })
  })
})

describe('bumpGeo', () => {
  it('increments an existing country and adds new ones', () => {
    const raw = JSON.stringify({ countries: { NO: 1 } })
    expect(bumpGeo(raw, 'NO')).toEqual({ countries: { NO: 2 } })
    expect(bumpGeo(raw, 'SE')).toEqual({ countries: { NO: 1, SE: 1 } })
  })

  it('returns null for unknown/reserved codes', () => {
    expect(bumpGeo(null, undefined)).toBeNull()
    expect(bumpGeo(null, 'XX')).toBeNull()
    expect(bumpGeo(null, 'T1')).toBeNull()
    expect(bumpGeo(null, 'no')).toBeNull()
  })
})

describe('mergeGeo', () => {
  it('merges a batch into existing data', () => {
    const raw = JSON.stringify({ countries: { NO: 5 } })
    expect(mergeGeo(raw, { NO: 2, SE: 1 })).toEqual({ countries: { NO: 7, SE: 1 } })
  })

  it('skips invalid codes and counts, returns null when nothing valid', () => {
    expect(mergeGeo(null, { XX: 3, T1: 1, no: 2, DE: 0, FR: -2 })).toBeNull()
    expect(mergeGeo(null, { XX: 3, NO: 1 })).toEqual({ countries: { NO: 1 } })
  })

  it('floors fractional counts', () => {
    expect(mergeGeo(null, { NO: 2.9 })).toEqual({ countries: { NO: 2 } })
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
