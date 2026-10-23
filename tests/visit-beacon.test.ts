import { describe, expect, it } from 'vitest'
import { HUMAN_EVENTS, localDay, shouldCountVisit } from '@/lib/visit'

describe('Besøk beacon rules (lib/visit.ts)', () => {
  it('names the day by the visitor’s own calendar, zero-padded', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(localDay(new Date(2026, 9, 23, 0, 1))).toBe('2026-10-23')
  })

  it('counts once a day, never under automation', () => {
    const today = '2026-10-23'
    expect(shouldCountVisit({ webdriver: false, lastDay: null, today })).toBe(true)
    expect(shouldCountVisit({ webdriver: false, lastDay: '2026-10-22', today })).toBe(true)
    expect(shouldCountVisit({ webdriver: false, lastDay: today, today })).toBe(false)
    expect(shouldCountVisit({ webdriver: true, lastDay: null, today })).toBe(false)
  })

  it('waits for input a script can’t fake into a scroll', () => {
    expect(HUMAN_EVENTS).not.toContain('scroll')
    expect(HUMAN_EVENTS).toEqual(expect.arrayContaining(['pointermove', 'touchstart', 'keydown']))
  })
})
