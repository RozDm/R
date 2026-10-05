import { describe, expect, it } from 'vitest'
import { handleCspReport } from '../../src/routes/csp-report'
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

  it('answers 204 but records nothing for junk or foreign documents', async () => {
    const fake = makeEnv()
    const junk = new Request(url, { method: 'POST', body: 'not json' })
    expect((await handleCspReport(url, junk, fake.env))!.status).toBe(204)
    expect((await handleCspReport(url, report('https://evil.example/', 'inline'), fake.env))!.status).toBe(204)
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

  it('refuses GET with 405 (the smoke check)', async () => {
    const res = (await handleCspReport(url, new Request(url), makeEnv().env))!
    expect(res.status).toBe(405)
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
