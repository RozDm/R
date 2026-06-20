import { describe, expect, it } from 'vitest'
import { fillBuckets } from '@/lib/timeseries-fill'

// Fixed reference instant: 2026-06-20 12:30:00 UTC. The hour floor is 12:00,
// which is also a 6h boundary, so both bucket sizes align cleanly.
const NOW = Date.UTC(2026, 5, 20, 12, 30, 0)

describe('fillBuckets', () => {
  it('returns one bucket per hour for 24h (window + 1) ending at the current hour', () => {
    const out = fillBuckets([], '24h', NOW)
    expect(out).toHaveLength(25)
    expect(out[0].ts).toBe('2026-06-19 12:00:00')
    expect(out[out.length - 1].ts).toBe('2026-06-20 12:00:00')
    expect(out.every((p) => p.value === 0)).toBe(true)
  })

  it('merges AE values onto matching bucket keys and zero-fills the rest', () => {
    const points = [
      { ts: '2026-06-20 10:00:00', value: 3 },
      { ts: '2026-06-20 12:00:00', value: 5 },
    ]
    const out = fillBuckets(points, '24h', NOW)
    expect(out.find((p) => p.ts === '2026-06-20 10:00:00')?.value).toBe(3)
    expect(out.find((p) => p.ts === '2026-06-20 12:00:00')?.value).toBe(5)
    expect(out.find((p) => p.ts === '2026-06-20 11:00:00')?.value).toBe(0)
    // Sum is preserved — zero-fill adds nothing to the total.
    expect(out.reduce((s, p) => s + p.value, 0)).toBe(8)
  })

  it('uses 6-hour buckets aligned to 00/06/12/18 UTC for 30d', () => {
    const out = fillBuckets([], '30d', NOW)
    expect(out).toHaveLength(121)
    expect(out[out.length - 1].ts).toBe('2026-06-20 12:00:00')
    expect(out[out.length - 2].ts).toBe('2026-06-20 06:00:00')
    expect(out[0].ts).toBe('2026-05-21 12:00:00')
  })

  it('uses hourly buckets for 7d (169 of them)', () => {
    const out = fillBuckets([], '7d', NOW)
    expect(out).toHaveLength(169)
    expect(out[out.length - 1].ts).toBe('2026-06-20 12:00:00')
  })

  it('falls back to the 7d shape on an unknown range', () => {
    expect(fillBuckets([], 'garbage', NOW)).toHaveLength(169)
  })

  it('ignores stray AE buckets outside the generated window', () => {
    const out = fillBuckets([{ ts: '2020-01-01 00:00:00', value: 99 }], '24h', NOW)
    expect(out.some((p) => p.value === 99)).toBe(false)
    expect(out).toHaveLength(25)
  })

  it('returns buckets in ascending time order', () => {
    const out = fillBuckets([], '24h', NOW)
    const sorted = [...out].sort((a, b) => a.ts.localeCompare(b.ts))
    expect(out).toEqual(sorted)
  })
})
