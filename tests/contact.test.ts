import { describe, expect, it } from 'vitest'
import { buildContactMime, encodeMimeHeader, validateContact } from '@/src/contact'

const valid = { name: 'Ola Nordmann', email: 'ola@example.no', message: 'Hei! Dette er en testmelding.' }

describe('validateContact', () => {
  it('accepts a normal payload and trims fields', () => {
    expect(validateContact({ ...valid, name: '  Ola Nordmann  ' })).toEqual({ ...valid, turnstileToken: null })
  })

  it('keeps a Turnstile token when present', () => {
    expect(validateContact({ ...valid, turnstileToken: 'tk' })).toEqual({ ...valid, turnstileToken: 'tk' })
  })

  it('treats empty/non-string tokens as missing', () => {
    expect(validateContact({ ...valid, turnstileToken: '' })?.turnstileToken).toBeNull()
    expect(validateContact({ ...valid, turnstileToken: 42 })?.turnstileToken).toBeNull()
  })

  it('rejects missing/short/long fields', () => {
    expect(validateContact(null)).toBeNull()
    expect(validateContact({})).toBeNull()
    expect(validateContact({ ...valid, name: '' })).toBeNull()
    expect(validateContact({ ...valid, name: 'x'.repeat(101) })).toBeNull()
    expect(validateContact({ ...valid, message: 'kort' })).toBeNull()
    expect(validateContact({ ...valid, message: 'x'.repeat(5001) })).toBeNull()
  })

  it('rejects invalid e-mail addresses', () => {
    expect(validateContact({ ...valid, email: 'not-an-email' })).toBeNull()
    expect(validateContact({ ...valid, email: 'a b@c.no' })).toBeNull()
    expect(validateContact({ ...valid, email: 'a@b' })).toBeNull()
  })

  it('rejects non-string field types', () => {
    expect(validateContact({ ...valid, message: 42 })).toBeNull()
  })
})

describe('encodeMimeHeader', () => {
  it('passes plain ASCII through', () => {
    expect(encodeMimeHeader('Hello world')).toBe('Hello world')
  })

  it('encodes non-ASCII as RFC 2047 utf-8 base64', () => {
    const encoded = encodeMimeHeader('Ny melding fra Bjørn')
    expect(encoded).toMatch(/^=\?utf-8\?B\?[A-Za-z0-9+/]+=*\?=$/)
    expect(Buffer.from(encoded.slice(10, -2), 'base64').toString('utf8')).toBe('Ny melding fra Bjørn')
  })
})

describe('buildContactMime', () => {
  const mime = buildContactMime('contact@rozsoshnykh.no', 'me@example.com', valid, '2026-06-12T18:00:00Z')

  it('carries the right envelope headers', () => {
    expect(mime).toContain('From: Kontaktskjema <contact@rozsoshnykh.no>')
    expect(mime).toContain('To: <me@example.com>')
    expect(mime).toContain('Reply-To: <ola@example.no>')
    expect(mime).toContain('Content-Type: text/plain; charset=utf-8')
  })

  it('base64 body decodes back to the message', () => {
    const body = mime.split('\r\n\r\n')[1].replace(/\r\n/g, '')
    const text = Buffer.from(body, 'base64').toString('utf8')
    expect(text).toContain('Navn: Ola Nordmann')
    expect(text).toContain('Hei! Dette er en testmelding.')
  })

  it('keeps body lines within RFC 2045 length', () => {
    const body = mime.split('\r\n\r\n')[1]
    for (const line of body.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(76)
    }
  })
})
