import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleContact } from '../../src/routes/contact'
import { BROWSER_HEADERS, makeEnv } from './fakes'

const URL_ = new URL('https://rozsoshnykh.no/api/contact')
const FORM = { name: 'Kari', email: 'kari@example.no', message: 'Hei! Dette er en test.' }

function post(body: unknown, headers: Record<string, string> = BROWSER_HEADERS): Request {
  return new Request(URL_, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

async function send(fake: ReturnType<typeof makeEnv>, body: unknown = FORM, headers?: Record<string, string>) {
  const res = (await handleContact(URL_, post(body, headers), fake.env))!
  return { status: res.status, body: await res.json() }
}

function rows(fake: ReturnType<typeof makeEnv>): number {
  return (fake.db.prepare('SELECT COUNT(*) AS n FROM contact').get() as { n: number }).n
}

// Insert a past submission directly, `at` in the same ISO form the route writes.
function seed(fake: ReturnType<typeof makeEnv>, minutesAgo: number, over: Partial<typeof FORM & { ip: string }> = {}) {
  const at = new Date(Date.now() - minutesAgo * 60_000).toISOString()
  fake.db
    .prepare('INSERT INTO contact (at, ip, name, email, message) VALUES (?1, ?2, ?3, ?4, ?5)')
    .run(at, over.ip ?? BROWSER_HEADERS['cf-connecting-ip'], FORM.name, over.email ?? FORM.email, over.message ?? FORM.message)
}

afterEach(() => vi.unstubAllGlobals())

describe('POST /api/contact', () => {
  it('stores the message and mails it', async () => {
    const fake = makeEnv()
    expect(await send(fake)).toEqual({ status: 200, body: { ok: true } })
    expect(rows(fake)).toBe(1)
    expect(fake.sent).toHaveLength(1)
    expect(fake.sent[0].raw).toContain('Reply-To: <kari@example.no>')
  })

  it('ignores paths and methods that are not its own', async () => {
    const fake = makeEnv()
    expect(await handleContact(new URL('https://rozsoshnykh.no/api/other'), post(FORM), fake.env)).toBeNull()
    expect(await handleContact(URL_, new Request(URL_), fake.env)).toBeNull()
  })

  it('refuses cross-site and bot requests', async () => {
    const fake = makeEnv()
    expect((await send(fake, FORM, { ...BROWSER_HEADERS, 'sec-fetch-site': 'cross-site' })).status).toBe(403)
    expect((await send(fake, FORM, { ...BROWSER_HEADERS, 'user-agent': 'curl/8.0' })).status).toBe(403)
    expect(fake.sent).toHaveLength(0)
  })

  it('acks a filled honeypot without storing or mailing', async () => {
    const fake = makeEnv()
    expect(await send(fake, { ...FORM, website: 'http://spam.example' })).toEqual({ status: 200, body: { ok: true } })
    expect(rows(fake)).toBe(0)
    expect(fake.sent).toHaveLength(0)
  })

  it('rejects invalid input with 422', async () => {
    const fake = makeEnv()
    expect((await send(fake, { ...FORM, email: 'kari@localhost' })).status).toBe(422)
    expect((await send(fake, { ...FORM, message: '   kort   ' })).status).toBe(422)
  })

  it('a failed mail send leaves no row, so the retry is mailed (not deduped)', async () => {
    const fake = makeEnv()
    fake.failMail(true)
    expect(await send(fake)).toEqual({ status: 502, body: { error: 'send failed' } })
    expect(rows(fake)).toBe(0)

    fake.failMail(false)
    expect(await send(fake)).toEqual({ status: 200, body: { ok: true } })
    expect(fake.sent).toHaveLength(1)
    expect(rows(fake)).toBe(1)
  })

  it('dedupes an identical resend within two minutes (one mail)', async () => {
    const fake = makeEnv()
    await send(fake)
    expect(await send(fake)).toEqual({ status: 200, body: { ok: true } })
    expect(fake.sent).toHaveLength(1)
    expect(rows(fake)).toBe(1)
  })

  // Regression: `at` is ISO ("…T18:00:00.000Z") and used to be compared with
  // SQLite's datetime('now', …) ("… 17:58:00"); the 'T' sorted after the
  // space, so any same-day row counted as "within two minutes" and a resend
  // hours later was ack'd and never mailed.
  it('mails the same message again when the earlier one is hours old', async () => {
    const fake = makeEnv()
    seed(fake, 5 * 60)
    expect(await send(fake)).toEqual({ status: 200, body: { ok: true } })
    expect(fake.sent).toHaveLength(1)
  })

  it('rate-limits the third submission per IP within ten minutes', async () => {
    const fake = makeEnv()
    seed(fake, 1, { email: 'a@example.no', message: 'første melding her' })
    seed(fake, 2, { email: 'b@example.no', message: 'andre melding her' })
    seed(fake, 3, { email: 'c@example.no', message: 'tredje melding her' })
    expect(await send(fake)).toEqual({ status: 429, body: { error: 'rate limited' } })
  })

  it('does not count IP submissions older than ten minutes (same day)', async () => {
    const fake = makeEnv()
    for (const m of [30, 90, 240]) seed(fake, m, { email: `x${m}@example.no`, message: `melding nummer ${m}` })
    expect((await send(fake)).status).toBe(200)
  })

  it('rate-limits the third submission per address within an hour, across IPs', async () => {
    const fake = makeEnv()
    seed(fake, 20, { ip: '198.51.100.1', message: 'første melding her' })
    seed(fake, 40, { ip: '198.51.100.2', message: 'andre melding her' })
    expect((await send(fake)).status).toBe(429)
    // …but not when those were hours ago.
    const later = makeEnv()
    seed(later, 120, { ip: '198.51.100.1', message: 'første melding her' })
    seed(later, 180, { ip: '198.51.100.2', message: 'andre melding her' })
    expect((await send(later)).status).toBe(200)
  })

  it('enforces Turnstile when the secret is set', async () => {
    const fake = makeEnv({ TURNSTILE_SECRET: 'secret' })
    expect(await send(fake)).toEqual({ status: 403, body: { error: 'challenge required' } })

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: false })))
    expect(await send(fake, { ...FORM, turnstileToken: 'spent' })).toEqual({ status: 403, body: { error: 'challenge failed' } })

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true })))
    expect(await send(fake, { ...FORM, turnstileToken: 'fresh' })).toEqual({ status: 200, body: { ok: true } })
    expect(fake.sent).toHaveLength(1)
  })
})
