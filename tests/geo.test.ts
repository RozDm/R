import { describe, expect, it } from 'vitest'
import { geoBucket } from '@/lib/geo'

describe('geoBucket', () => {
  it('returns null for countries without visits', () => {
    expect(geoBucket(undefined, 10)).toBeNull()
    expect(geoBucket(0, 10)).toBeNull()
  })

  it('gives the busiest country the top shade', () => {
    expect(geoBucket(56, 56)).toBe('3')
    expect(geoBucket(1, 1)).toBe('3')
  })

  it('spreads a real distribution over all three shades', () => {
    // The live map on 2026-10-04: US 56, NO 31, UA 6, a tail of 1–5.
    expect(geoBucket(31, 56)).toBe('3')
    expect(geoBucket(6, 56)).toBe('2')
    expect(geoBucket(3, 56)).toBe('2')
    expect(geoBucket(1, 56)).toBe('1')
  })

  it('stays relative as traffic grows (no single-colour map)', () => {
    // With the old fixed <3/<10/≥10 cut-offs 5000 and 100 shared one shade.
    const buckets = [5000, 100, 5].map((n) => geoBucket(n, 5000))
    expect(new Set(buckets).size).toBe(3)
  })

  it('never exceeds the top bucket when count > max', () => {
    expect(geoBucket(10, 5)).toBe('3')
  })
})
