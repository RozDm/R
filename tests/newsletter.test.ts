import { describe, expect, it } from 'vitest'
import { buildConfirmEmail, isValidConfirmToken, validateNewsletter } from '@/src/newsletter'

describe('validateNewsletter', () => {
  it('accepts a well-formed email with explicit consent', () => {
    const out = validateNewsletter({ email: 'reader@example.com', consent: true })
    expect(out).toEqual({
      email: 'reader@example.com',
      consent: true,
      website: '',
    })
  })

  it('normalises the email — trims whitespace and lowercases', () => {
    const out = validateNewsletter({ email: '  Reader@Example.COM  ', consent: true })
    expect(out?.email).toBe('reader@example.com')
  })

  it('preserves the honeypot value for the route to inspect', () => {
    const out = validateNewsletter({
      email: 'a@b.co',
      consent: true,
      website: 'spam',
    })
    expect(out?.website).toBe('spam')
  })

  it('rejects when consent is missing or false (GDPR opt-in must be explicit)', () => {
    expect(validateNewsletter({ email: 'a@b.co' })).toBeNull()
    expect(validateNewsletter({ email: 'a@b.co', consent: false })).toBeNull()
    expect(validateNewsletter({ email: 'a@b.co', consent: 'yes' })).toBeNull()
  })

  it('rejects malformed emails', () => {
    expect(validateNewsletter({ email: 'not-an-email', consent: true })).toBeNull()
    expect(validateNewsletter({ email: 'missing@tld', consent: true })).toBeNull()
    expect(validateNewsletter({ email: 'spaces in@addr.co', consent: true })).toBeNull()
    expect(validateNewsletter({ email: '', consent: true })).toBeNull()
  })

  it('rejects emails over the 200-char limit', () => {
    const long = `${'a'.repeat(200)}@x.co`
    expect(validateNewsletter({ email: long, consent: true })).toBeNull()
  })

  it('returns null on non-object / null input', () => {
    expect(validateNewsletter(null)).toBeNull()
    expect(validateNewsletter('reader@example.com')).toBeNull()
    expect(validateNewsletter(undefined)).toBeNull()
  })
})

describe('isValidConfirmToken', () => {
  it('accepts a UUID v4 (crypto.randomUUID output shape)', () => {
    expect(isValidConfirmToken('11111111-2222-4333-8444-555555555555')).toBe(true)
    expect(isValidConfirmToken('AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE')).toBe(true)
  })

  it('rejects non-UUID strings, empty, null', () => {
    expect(isValidConfirmToken(null)).toBe(false)
    expect(isValidConfirmToken('')).toBe(false)
    expect(isValidConfirmToken('not-a-uuid')).toBe(false)
    // Wrong segment lengths.
    expect(isValidConfirmToken('1111111-2222-4333-8444-555555555555')).toBe(false)
    // SQL-shaped attempt — must not slip through as a "valid" token.
    expect(isValidConfirmToken("' OR 1=1 --")).toBe(false)
  })
})

describe('buildConfirmEmail', () => {
  it('embeds the confirm URL with the token in both text and html', () => {
    const out = buildConfirmEmail({
      siteUrl: 'https://rozsoshnykh.no',
      token: '11111111-2222-4333-8444-555555555555',
    })
    expect(out.subject).toMatch(/bekreft/i)
    expect(out.text).toContain('https://rozsoshnykh.no/api/newsletter/confirm?token=11111111-2222-4333-8444-555555555555')
    expect(out.html).toContain('https://rozsoshnykh.no/api/newsletter/confirm?token=11111111-2222-4333-8444-555555555555')
  })

  it('does NOT embed the unsubscribe/DELETE link in the confirm mail (scanners prefetch links)', () => {
    const out = buildConfirmEmail({
      siteUrl: 'https://rozsoshnykh.no',
      token: '11111111-2222-4333-8444-555555555555',
    })
    // A mail-security scanner that GETs every URL in the body must not be able
    // to delete the just-created row — the confirm mail carries no opt-out link.
    expect(out.text).not.toContain('/unsubscribe')
    expect(out.html).not.toContain('/unsubscribe')
  })
})
