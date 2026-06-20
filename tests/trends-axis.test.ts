import { describe, expect, it } from 'vitest'
import { xTicksFor } from '@/lib/trends-axis'

// Tiny shape that mirrors what Trends.tsx feeds in (a coord + a timestamp).
interface P { x: number; label: string }
const point = (x: number, label: string): P => ({ x, label })
const pickX = (p: P) => p.x
const pickLabel = (p: P) => p.label

describe('xTicksFor', () => {
  it('returns no ticks for an empty series', () => {
    expect(xTicksFor([], pickX, pickLabel)).toEqual([])
  })

  it('returns a single centred tick for one point', () => {
    expect(xTicksFor([point(400, '12:00')], pickX, pickLabel)).toEqual([
      { x: 400, label: '12:00' },
    ])
  })

  // The original bug — Math.floor(2/2) === 1 made the "middle" tick collide
  // with the "last" tick at the same x, so the chart rendered two text
  // elements stacked on top of each other.
  it('for exactly 2 points returns first + last only (no mid collision)', () => {
    const ticks = xTicksFor(
      [point(40, '15:00'), point(788, '20:00')],
      pickX,
      pickLabel,
    )
    expect(ticks).toEqual([
      { x: 40, label: '15:00' },
      { x: 788, label: '20:00' },
    ])
    // Explicit guard against the regression: no two ticks may share an x.
    expect(new Set(ticks.map((t) => t.x)).size).toBe(ticks.length)
  })

  it('for 3+ points returns first / middle / last', () => {
    const pts = [
      point(0, 'a'),
      point(100, 'b'),
      point(200, 'c'),
      point(300, 'd'),
      point(400, 'e'),
    ]
    const ticks = xTicksFor(pts, pickX, pickLabel)
    expect(ticks).toEqual([
      { x: 0, label: 'a' },
      { x: 200, label: 'c' },
      { x: 400, label: 'e' },
    ])
  })

  it('preserves uniqueness for every series length 1..7', () => {
    for (let n = 1; n <= 7; n++) {
      const pts = Array.from({ length: n }, (_, i) => point(i * 100, String(i)))
      const ticks = xTicksFor(pts, pickX, pickLabel)
      expect(new Set(ticks.map((t) => t.x)).size).toBe(ticks.length)
    }
  })
})
