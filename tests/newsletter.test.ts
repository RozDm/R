import { describe, expect, it } from 'vitest'
import { validateNewsletter } from '@/src/newsletter'

describe('validateNewsletter', () => {
  it('accepts a well-formed email with explicit consent', () => {
    const out = validateNewsletter({ email: 'reader@example.com', consent: true })
    expect(out).toEqual({
      email: 'reader@example.com',
      consent: true,
      turnstileToken: null,
      website: '',
    })
  })

  it('normalises the email — trims whitespace and lowercases', () => {
    const out = validateNewsletter({ email: '  Reader@Example.COM  ', consent: true })
    expect(out?.email).toBe('reader@example.com')
  })

  it('preserves a Turnstile token + honeypot value for the route to inspect', () => {
    const out = validateNewsletter({
      email: 'a@b.co',
      consent: true,
      turnstileToken: 'tok123',
      website: 'spam',
    })
    expect(out?.turnstileToken).toBe('tok123')
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
