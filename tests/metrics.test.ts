import { describe, expect, it } from 'vitest'
import { bumpGeo, isValidSlug, looksLikeBot, parseCount, parseGeo } from '@/src/metrics'

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
