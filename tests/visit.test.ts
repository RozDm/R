import { describe, expect, it } from 'vitest'
import { isWriteAllowed } from '@/src/metrics'

const ORIGIN = 'https://rozsoshnykh.no'
const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'

describe('isWriteAllowed — the gate for /api/visit & friends', () => {
  it('allows a same-origin POST from a real browser', () => {
    const h = new Headers({ 'sec-fetch-site': 'same-origin', 'user-agent': CHROME })
    expect(isWriteAllowed(h, ORIGIN)).toBe(true)
  })

  it('rejects cross-site POSTs (CSRF defence)', () => {
    const h = new Headers({ 'sec-fetch-site': 'cross-site', 'user-agent': CHROME })
    expect(isWriteAllowed(h, ORIGIN)).toBe(false)
  })

  it('rejects same-site (different subdomain) POSTs — still external to us', () => {
    const h = new Headers({ 'sec-fetch-site': 'same-site', 'user-agent': CHROME })
    expect(isWriteAllowed(h, ORIGIN)).toBe(false)
  })

  it('without Sec-Fetch-Site (Safari < 16.4), lets in our own Origin only', () => {
    expect(isWriteAllowed(new Headers({ origin: ORIGIN, 'user-agent': CHROME }), ORIGIN)).toBe(true)
    expect(isWriteAllowed(new Headers({ origin: 'https://evil.example', 'user-agent': CHROME }), ORIGIN)).toBe(false)
    expect(isWriteAllowed(new Headers({ 'user-agent': CHROME }), ORIGIN)).toBe(false)
  })

  it('trusts Sec-Fetch-Site over Origin when the browser sends it', () => {
    const h = new Headers({ 'sec-fetch-site': 'cross-site', origin: ORIGIN, 'user-agent': CHROME })
    expect(isWriteAllowed(h, ORIGIN)).toBe(false)
  })

  it('rejects a bot UA even with the right Sec-Fetch-Site', () => {
    const h = new Headers({ 'sec-fetch-site': 'same-origin', 'user-agent': 'Googlebot/2.1' })
    expect(isWriteAllowed(h, ORIGIN)).toBe(false)
  })

  it('rejects the smoke-test UA (so the CI smoke check cannot accidentally count itself)', () => {
    const h = new Headers({
      'sec-fetch-site': 'same-origin',
      'user-agent': 'smoke-test/1.0 (+https://rozsoshnykh.no)',
    })
    expect(isWriteAllowed(h, ORIGIN)).toBe(false)
  })

  it('rejects a missing UA outright', () => {
    const h = new Headers({ 'sec-fetch-site': 'same-origin' })
    expect(isWriteAllowed(h, ORIGIN)).toBe(false)
  })
})
