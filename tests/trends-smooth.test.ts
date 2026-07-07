import { describe, expect, it } from 'vitest'
import { kdeSmooth, sigmaForBuckets } from '@/lib/trends-smooth'

describe('kdeSmooth', () => {
  it('leaves an all-zero series at zero', () => {
    expect(kdeSmooth([0, 0, 0, 0], 1.5)).toEqual([0, 0, 0, 0])
  })

  it('returns [] for an empty series and copies through when sigma <= 0', () => {
    expect(kdeSmooth([], 1.5)).toEqual([])
    expect(kdeSmooth([1, 2, 3], 0)).toEqual([1, 2, 3])
  })

  it('spreads a lone spike into a smooth symmetric hill peaking at the spike', () => {
    const out = kdeSmooth([0, 0, 1, 0, 0], 1)
    // Peak stays at the spike index and the curve decays monotonically away.
    expect(out[2]).toBeGreaterThan(out[1])
    expect(out[2]).toBeGreaterThan(out[3])
    expect(out[1]).toBeGreaterThan(out[0])
    expect(out[3]).toBeGreaterThan(out[4])
    // Symmetric about the spike.
    expect(out[1]).toBeCloseTo(out[3], 10)
    expect(out[0]).toBeCloseTo(out[4], 10)
    // A peak-1 kernel: the spike's own bucket tops out at exactly its count.
    expect(out[2]).toBeCloseTo(1, 10)
  })

  it('never produces a negative value from non-negative input', () => {
    const out = kdeSmooth([0, 3, 0, 1, 0, 2, 0], 2)
    expect(out.every((v) => v >= 0)).toBe(true)
  })

  it('sums adjacent visits into a taller combined hill than a lone visit', () => {
    const lone = kdeSmooth([0, 0, 1, 0, 0, 0, 0], 1.2)
    const pair = kdeSmooth([0, 0, 0, 1, 1, 0, 0], 1.2)
    expect(Math.max(...pair)).toBeGreaterThan(Math.max(...lone))
  })

  it('preserves length', () => {
    expect(kdeSmooth(new Array(169).fill(0), 5)).toHaveLength(169)
  })
})

describe('sigmaForBuckets', () => {
  it('floors small grids and scales with larger ones', () => {
    expect(sigmaForBuckets(25)).toBe(1.2) // 24t: 25*0.03 < 1.2 floor
    expect(sigmaForBuckets(169)).toBeCloseTo(5.07, 2) // 7d
    expect(sigmaForBuckets(121)).toBeCloseTo(3.63, 2) // 30d
  })

  it('caps so a huge grid is not over-blurred', () => {
    expect(sigmaForBuckets(10000)).toBe(8)
  })
})
