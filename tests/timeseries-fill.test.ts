import { describe, expect, it } from 'vitest'
import { fillBuckets } from '@/lib/timeseries-fill'
import { METRICS_EPOCH } from '@/src/timeseries'

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

  it('normalises AE keys before merging so an ISO-format drift still hits', () => {
    // If AE ever switched from "2026-06-20 10:00:00" to the ISO 'T'/'Z' shape,
    // a raw string merge would miss every bucket and blank the chart. The
    // normalising merge must still land these on the space-form grid keys.
    const points = [
      { ts: '2026-06-20T10:00:00Z', value: 3 },
      { ts: '2026-06-20T12:00:00.000Z', value: 5 },
    ]
    const out = fillBuckets(points, '24h', NOW)
    expect(out.find((p) => p.ts === '2026-06-20 10:00:00')?.value).toBe(3)
    expect(out.find((p) => p.ts === '2026-06-20 12:00:00')?.value).toBe(5)
    expect(out.reduce((s, p) => s + p.value, 0)).toBe(8)
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

// The `all` range is dynamic: its span is METRICS_EPOCH → now (6h buckets),
// capped near AE retention. Expectations are derived from METRICS_EPOCH so a
// future epoch bump (still on its 6h boundary) doesn't brittle-break these.
const SIX_H = 6 * 3_600_000
const epochMs = Date.parse(METRICS_EPOCH.replace(' ', 'T') + 'Z')
const msOf = (ts: string) => Date.parse(ts.replace(' ', 'T') + 'Z')

describe('fillBuckets all', () => {
  it('spans the epoch → now window in ascending, uniform 6h buckets', () => {
    const now = epochMs + 12 * SIX_H + 1000 // 12 buckets past the epoch
    const out = fillBuckets([], 'all', now)
    expect(out).toHaveLength(13) // 12 steps + the epoch bucket itself
    expect(out[0].ts).toBe(METRICS_EPOCH) // epoch sits on a 6h boundary
    expect(msOf(out[out.length - 1].ts)).toBe(Math.floor(now / SIX_H) * SIX_H)
    for (let i = 1; i < out.length; i++) {
      expect(msOf(out[i].ts) - msOf(out[i - 1].ts)).toBe(SIX_H)
    }
    expect(out.every((p) => p.value === 0)).toBe(true)
  })

  it('merges AE values (incl. ISO-drift keys) onto the all-time grid', () => {
    const now = epochMs + 12 * SIX_H + 1000
    const iso = new Date(epochMs + 4 * SIX_H).toISOString() // in-window, ISO 'T'/'Z'/ms
    const out = fillBuckets(
      [
        { ts: METRICS_EPOCH, value: 2 },
        { ts: iso, value: 4 },
      ],
      'all',
      now,
    )
    expect(out[0].value).toBe(2)
    expect(out.find((p) => msOf(p.ts) === epochMs + 4 * SIX_H)?.value).toBe(4)
    expect(out.reduce((s, p) => s + p.value, 0)).toBe(6)
  })

  it('caps the bucket count on an aged site (AE-retention bound)', () => {
    const now = epochMs + 1000 * SIX_H // far past the ~361-bucket cap
    const out = fillBuckets([], 'all', now)
    expect(out).toHaveLength(361)
    expect(msOf(out[out.length - 1].ts)).toBe(Math.floor(now / SIX_H) * SIX_H)
  })
})
