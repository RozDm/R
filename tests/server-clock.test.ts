import { describe, expect, it } from 'vitest'
import { SKEW_IGNORED_MS, clockSkew } from '../lib/server-clock'

const SERVER = Date.parse('Tue, 10 Nov 2026 18:22:07 GMT')

describe('clockSkew', () => {
  it('is the gap between the Date header and a wrong local clock', () => {
    const twoDays = 2 * 86_400_000
    expect(clockSkew('Tue, 10 Nov 2026 18:22:07 GMT', SERVER + twoDays)).toBe(-twoDays)
    expect(clockSkew('Tue, 10 Nov 2026 18:22:07 GMT', SERVER - twoDays)).toBe(twoDays)
  })

  // One-second grain and the answer's time on the wire: a clock that is right
  // must get the local time back, untouched.
  it('ignores a gap that is only latency', () => {
    expect(clockSkew('Tue, 10 Nov 2026 18:22:07 GMT', SERVER + 1_500)).toBe(0)
    expect(clockSkew('Tue, 10 Nov 2026 18:22:07 GMT', SERVER - (SKEW_IGNORED_MS - 1))).toBe(0)
    expect(clockSkew('Tue, 10 Nov 2026 18:22:07 GMT', SERVER - SKEW_IGNORED_MS)).toBe(SKEW_IGNORED_MS)
  })

  it('is zero without a usable header', () => {
    expect(clockSkew(null, SERVER)).toBe(0)
    expect(clockSkew('', SERVER)).toBe(0)
    expect(clockSkew('not a date', SERVER)).toBe(0)
  })
})
