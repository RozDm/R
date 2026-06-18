import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildContactMime,
  buildStatusAlertMime,
  encodeMimeHeader,
  validateContact,
  verifyTurnstile,
} from '@/src/contact'

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

describe('buildStatusAlertMime', () => {
  const monitor = { name: 'NetBox', url: 'https://netbox.test/', ok: false, status: 502, ms: 1234 }
  const mime = buildStatusAlertMime('status@rozsoshnykh.no', 'me@example.com', monitor, '2026-06-12T18:00:00Z')

  it('carries the right envelope headers and no Reply-To', () => {
    expect(mime).toContain('From: Status <status@rozsoshnykh.no>')
    expect(mime).toContain('To: <me@example.com>')
    expect(mime).not.toContain('Reply-To:')
  })

  it('uses distinct Norwegian subjects for down and recovery', () => {
    const downSubject = mime.split('\r\n').find((l) => l.startsWith('Subject: '))
    expect(downSubject).toBe('Subject: Status: NetBox er nede')

    const up = buildStatusAlertMime('status@rozsoshnykh.no', 'me@example.com', { ...monitor, ok: true, status: 200 }, '2026-06-12T18:00:00Z')
    const upSubject = up.split('\r\n').find((l) => l.startsWith('Subject: '))
    expect(upSubject).toBe('Subject: Status: NetBox er oppe igjen')
  })

  it('RFC 2047-encodes a service name with non-ASCII characters', () => {
    const m = buildStatusAlertMime(
      'status@rozsoshnykh.no',
      'me@example.com',
      { ...monitor, name: 'Overvåking' },
      '2026-06-12T18:00:00Z',
    )
    const subject = m.split('\r\n').find((l) => l.startsWith('Subject: '))
    expect(subject).toMatch(/^Subject: =\?utf-8\?B\?[A-Za-z0-9+/]+=*\?=$/)
  })

  it('base64 body decodes back to the monitor details', () => {
    const body = mime.split('\r\n\r\n')[1].replace(/\r\n/g, '')
    const text = Buffer.from(body, 'base64').toString('utf8')
    expect(text).toContain('Tjeneste: NetBox')
    expect(text).toContain('URL: https://netbox.test/')
    expect(text).toContain('HTTP: 502')
    expect(text).toContain('Latens: 1234 ms')
    expect(text).toContain('Status: NEDE')
  })
})

describe('verifyTurnstile', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns true when siteverify reports success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })))
    expect(await verifyTurnstile('tok', 'secret', '1.2.3.4')).toBe(true)
  })

  it('returns false when siteverify reports failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 })))
    expect(await verifyTurnstile('tok', 'secret')).toBe(false)
  })

  it('fails closed on a non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })))
    expect(await verifyTurnstile('tok', 'secret')).toBe(false)
  })

  it('fails closed when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    expect(await verifyTurnstile('tok', 'secret')).toBe(false)
  })

  it('passes the token and remoteip to siteverify', async () => {
    let captured: URLSearchParams | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        captured = init?.body as URLSearchParams
        return new Response(JSON.stringify({ success: true }), { status: 200 })
      }),
    )
    await verifyTurnstile('the-token', 'the-secret', '9.9.9.9')
    expect(captured?.get('response')).toBe('the-token')
    expect(captured?.get('secret')).toBe('the-secret')
    expect(captured?.get('remoteip')).toBe('9.9.9.9')
  })
})
