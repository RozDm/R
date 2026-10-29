import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleCspReport } from '../../src/routes/csp-report'
import { handleGeo } from '../../src/routes/geo'
import { handleViews } from '../../src/routes/views'
import { handleVisit } from '../../src/routes/visit'
import { BROWSER_HEADERS, makeCtx, makeEnv } from './fakes'

const ORIGIN = 'https://rozsoshnykh.no'

describe('/api/csp-report', () => {
  const url = new URL(`${ORIGIN}/api/csp-report`)
  const report = (doc: string, blocked: string) =>
    new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report' },
      body: JSON.stringify({
        'csp-report': { 'document-uri': doc, 'blocked-uri': blocked, 'violated-directive': 'script-src-elem' },
      }),
    })

  it('records an own-origin violation as one AE point and answers 204', async () => {
    const fake = makeEnv()
    const res = (await handleCspReport(url, report(`${ORIGIN}/kontakt/?x=1`, 'inline'), fake.env))!
    expect(res.status).toBe(204)
    expect(fake.aePoints).toEqual([
      { indexes: ['csp'], blobs: ['csp', 'script-src-elem', 'inline', '/kontakt/'], doubles: [1] },
    ])
  })

  it('records one point per POST, however many reports the batch holds', async () => {
    const fake = makeEnv()
    const one = (blocked: string) => ({
      type: 'csp-violation',
      body: { documentURL: `${ORIGIN}/`, blockedURL: blocked, effectiveDirective: 'script-src-elem' },
    })
    const batch = new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/reports+json' },
      body: JSON.stringify([one('inline'), one('https://evil.example/x.js'), one('eval')]),
    })
    expect((await handleCspReport(url, batch, fake.env))!.status).toBe(204)
    expect(fake.aePoints).toEqual([{ indexes: ['csp'], blobs: ['csp', 'script-src-elem', 'inline', '/'], doubles: [1] }])
  })

  it('answers 204 but records nothing for junk or foreign documents', async () => {
    const fake = makeEnv()
    const junk = new Request(url, { method: 'POST', body: 'not json' })
    expect((await handleCspReport(url, junk, fake.env))!.status).toBe(204)
    expect((await handleCspReport(url, report('https://evil.example/', 'inline'), fake.env))!.status).toBe(204)
    expect(fake.aePoints).toEqual([])
  })

  it('drops an oversized body unread, even without a Content-Length', async () => {
    const fake = makeEnv()
    const valid = JSON.stringify({
      'csp-report': { 'document-uri': `${ORIGIN}/`, 'blocked-uri': 'inline', 'violated-directive': 'script-src-elem', pad: 'x'.repeat(70_000) },
    })
    const bytes = new TextEncoder().encode(valid)
    // A stream body: the request carries no Content-Length to refuse it by.
    const body = new ReadableStream({ start: (c) => (c.enqueue(bytes), c.close()) })
    const req = new Request(url, { method: 'POST', body, duplex: 'half' } as RequestInit)
    expect((await handleCspReport(url, req, fake.env))!.status).toBe(204)
    expect(fake.aePoints).toEqual([])
  })

  it('drops reports past the per-IP budget', async () => {
    const fake = makeEnv()
    fake.setRateLimit(1)
    const send = (ip: string) => {
      const req = report(`${ORIGIN}/`, 'inline')
      req.headers.set('cf-connecting-ip', ip)
      return handleCspReport(url, req, fake.env)
    }
    expect((await send('203.0.113.9'))!.status).toBe(204)
    expect((await send('203.0.113.9'))!.status).toBe(204)
    expect((await send('203.0.113.10'))!.status).toBe(204)
    expect(fake.aePoints).toHaveLength(2)
  })

  it('budgets a whole IPv6 /64 as one client', async () => {
    const fake = makeEnv()
    fake.setRateLimit(1)
    const send = (ip: string) => {
      const req = report(`${ORIGIN}/`, 'inline')
      req.headers.set('cf-connecting-ip', ip)
      return handleCspReport(url, req, fake.env)
    }
    await send('2001:db8:aa:bb::1')
    await send('2001:db8:aa:bb::2')
    await send('2001:db8:aa:bc::1')
    expect(fake.aePoints).toHaveLength(2)
  })

  it('refuses GET with 405 (the smoke check)', async () => {
    const res = (await handleCspReport(url, new Request(url), makeEnv().env))!
    expect(res.status).toBe(405)
  })
})

describe('/api/geo', () => {
  const url = new URL(`${ORIGIN}/api/geo`)
  const puts: string[] = []
  const stubCache = () => {
    puts.length = 0
    vi.stubGlobal('caches', {
      default: { match: async () => undefined, put: async (key: Request) => void puts.push(key.url) },
    })
  }
  afterEach(() => vi.unstubAllGlobals())

  it('answers the counts with 200 and edge-caches them', async () => {
    stubCache()
    const fake = makeEnv()
    fake.db.exec("INSERT INTO geo (country, count) VALUES ('NO', 3)")
    const { ctx, settle } = makeCtx()
    const res = (await handleGeo(url, fake.env, ctx))!
    await settle()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ countries: { NO: 3 } })
    expect(puts).toEqual([url.href])
  })

  // A dead D1 once answered an empty map with a 200, which smoke.sh and the
  // watchdog took for health (docs/history.md).
  it('answers a failed D1 read with an uncached 503, never an empty map', async () => {
    stubCache()
    const failing = { prepare: () => ({ all: async () => Promise.reject(new Error('D1_ERROR')) }) }
    const fake = makeEnv({ METRICS: failing })
    const { ctx, settle } = makeCtx()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = (await handleGeo(url, fake.env, ctx))!
    await settle()
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ error: 'unavailable' })
    expect(puts).toEqual([])
    expect(error).toHaveBeenCalledWith('geo: D1 read failed', expect.any(Error))
    error.mockRestore()
  })
})

describe('/api/views/<slug>', () => {
  const post = (slug: string, headers = BROWSER_HEADERS) =>
    new Request(`${ORIGIN}/api/views/${slug}`, { method: 'POST', headers })

  it('counts a view of a published post and writes an AE point', async () => {
    const fake = makeEnv()
    const url = new URL(`${ORIGIN}/api/views/velkommen`)
    expect(await (await handleViews(url, post('velkommen'), fake.env))!.json()).toEqual({ views: 1 })
    expect(await (await handleViews(url, post('velkommen'), fake.env))!.json()).toEqual({ views: 2 })
    expect(fake.aePoints.map((p) => p.blobs)).toEqual([
      ['view', 'velkommen'],
      ['view', 'velkommen'],
    ])
  })

  it('counts an English-only post under its own slug', async () => {
    const fake = makeEnv()
    const url = new URL(`${ORIGIN}/api/views/english-only`)
    expect(await (await handleViews(url, post('english-only'), fake.env))!.json()).toEqual({ views: 1 })
  })

  it('never mints a row for a slug that is not a published page', async () => {
    const fake = makeEnv()
    const url = new URL(`${ORIGIN}/api/views/finnes-ikke`)
    expect(await (await handleViews(url, post('finnes-ikke'), fake.env))!.json()).toEqual({ views: 0 })
    expect(fake.db.prepare('SELECT COUNT(*) AS n FROM views').get()).toEqual({ n: 0 })
  })

  it('reads without counting on GET and for bots', async () => {
    const fake = makeEnv()
    const url = new URL(`${ORIGIN}/api/views/velkommen`)
    await handleViews(url, post('velkommen', { ...BROWSER_HEADERS, 'user-agent': 'Googlebot/2.1' }), fake.env)
    expect(await (await handleViews(url, new Request(url), fake.env))!.json()).toEqual({ views: 0 })
  })

  it('reads without counting from a datacenter network', async () => {
    const fake = makeEnv()
    const url = new URL(`${ORIGIN}/api/views/velkommen`)
    const req = post('velkommen')
    Object.defineProperty(req, 'cf', { value: { asn: 16509 } }) // AWS
    expect(await (await handleViews(url, req, fake.env))!.json()).toEqual({ views: 0 })
    expect(fake.aePoints).toEqual([])
  })

  it('past the per-IP budget a POST reads instead of counting', async () => {
    const fake = makeEnv()
    fake.setRateLimit(1)
    const url = new URL(`${ORIGIN}/api/views/velkommen`)
    expect(await (await handleViews(url, post('velkommen'), fake.env))!.json()).toEqual({ views: 1 })
    expect(await (await handleViews(url, post('velkommen'), fake.env))!.json()).toEqual({ views: 1 })
    expect(fake.aePoints).toHaveLength(1)
  })

  it('rejects malformed slugs', async () => {
    const url = new URL(`${ORIGIN}/api/views/Bad_Slug`)
    expect((await handleViews(url, new Request(url), makeEnv().env))!.status).toBe(400)
  })
})

describe('/api/visit', () => {
  const url = new URL(`${ORIGIN}/api/visit`)
  const visit = (cf: Record<string, unknown>, headers = BROWSER_HEADERS) => {
    const req = new Request(url, { method: 'POST', headers })
    Object.defineProperty(req, 'cf', { value: cf })
    return req
  }

  it('counts the country in D1 and writes an AE point with the network', async () => {
    const fake = makeEnv()
    const { ctx, settle } = makeCtx()
    const res = (await handleVisit(url, visit({ country: 'NO', asn: 2119, asOrganization: 'Telenor Norge AS' }), fake.env, ctx))!
    await settle()
    expect(res.status).toBe(200)
    expect(fake.db.prepare('SELECT country, count FROM geo').all()).toEqual([{ country: 'NO', count: 1 }])
    expect(fake.aePoints[0].blobs).toEqual(['geo', 'NO', 'AS2119', 'Telenor Norge AS'])
  })

  it('keeps datacenter networks off the map but logs them to AE as bot', async () => {
    const fake = makeEnv()
    const { ctx, settle } = makeCtx()
    const res = (await handleVisit(url, visit({ country: 'US', asn: 16509, asOrganization: 'AMAZON-02' }), fake.env, ctx))!
    await settle()
    expect(res.status).toBe(200)
    expect(fake.db.prepare('SELECT COUNT(*) AS n FROM geo').get()).toEqual({ n: 0 })
    expect(fake.aePoints.map((p) => p.blobs)).toEqual([['bot', 'US', 'AS16509', 'AMAZON-02']])
  })

  it('skips pseudo-countries and refuses bots', async () => {
    const fake = makeEnv()
    const { ctx, settle } = makeCtx()
    await handleVisit(url, visit({ country: 'T1' }), fake.env, ctx)
    const bot = (await handleVisit(url, visit({ country: 'NO' }, { ...BROWSER_HEADERS, 'user-agent': 'HeadlessChrome' }), fake.env, ctx))!
    await settle()
    expect(bot.status).toBe(403)
    expect(fake.db.prepare('SELECT COUNT(*) AS n FROM geo').get()).toEqual({ n: 0 })
    expect(fake.aePoints).toEqual([])
  })

  it('answers 429 past the per-IP budget and records nothing more', async () => {
    const fake = makeEnv()
    fake.setRateLimit(1)
    const { ctx, settle } = makeCtx()
    expect((await handleVisit(url, visit({ country: 'NO' }), fake.env, ctx))!.status).toBe(200)
    expect((await handleVisit(url, visit({ country: 'NO' }), fake.env, ctx))!.status).toBe(429)
    await settle()
    expect(fake.db.prepare('SELECT country, count FROM geo').all()).toEqual([{ country: 'NO', count: 1 }])
  })
})
