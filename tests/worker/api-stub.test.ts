// The browser tests' /api/* stand-ins (e2e/api-stub.ts) must answer as the
// real route handlers do — same status, same JSON shape — or the e2e tests
// exercise a contract production doesn't serve (the stubs once answered the
// view and visit POSTs with an empty 204; the Worker sends 200 + JSON).
// Each real handler runs here on the fakes, seeded with the stub's own data.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STUB_COUNTRIES, STUB_MONITORS, apiStub } from '../../e2e/api-stub'
import { handleContact } from '../../src/routes/contact'
import { handleGeo } from '../../src/routes/geo'
import { handleStatus } from '../../src/routes/status'
import { handleTimeseries } from '../../src/routes/timeseries'
import { handleViews } from '../../src/routes/views'
import { handleVisit } from '../../src/routes/visit'
import { buildStatusData } from '../../src/status'
import { BROWSER_HEADERS, makeCtx, makeEnv } from './fakes'

const ORIGIN = 'https://rozsoshnykh.no'

// The JSON's skeleton: key names and value types, an array by its first item.
function shape(v: unknown): unknown {
  if (Array.isArray(v)) return v.length ? [shape(v[0])] : []
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => [k, shape(x)]),
    )
  }
  return v === null ? 'null' : typeof v
}

async function answer(res: Response | null) {
  expect(res).not.toBeNull()
  const text = await res!.text()
  return { status: res!.status, body: text ? JSON.parse(text) : null }
}

function stub(path: string, method = 'GET') {
  const { status, body } = apiStub(new URL(`${ORIGIN}${path}`), method)
  return { status, body: body ? JSON.parse(body) : null }
}

function expectSameContract(real: { status: number; body: unknown }, fake: { status: number; body: unknown }) {
  expect(fake.status).toBe(real.status)
  expect(shape(fake.body)).toEqual(shape(real.body))
}

afterEach(() => vi.unstubAllGlobals())

describe('e2e API stubs answer like the Worker', () => {
  const stubCache = () =>
    vi.stubGlobal('caches', { default: { match: async () => undefined, put: async () => {} } })

  it('/api/status — the snapshot the cron writes', async () => {
    stubCache()
    const fake = makeEnv()
    const probes = STUB_MONITORS.map((name) => ({ name, url: 'https://example.test/', ok: true, status: 200, ms: 100 }))
    fake.kv.set('status', JSON.stringify(buildStatusData(null, probes, new Date().toISOString())))
    const { ctx } = makeCtx()
    expectSameContract(await answer(await handleStatus(new URL(`${ORIGIN}/api/status`), fake.env, ctx)), stub('/api/status'))
  })

  it('/api/geo', async () => {
    stubCache()
    const fake = makeEnv()
    for (const [c, n] of Object.entries(STUB_COUNTRIES)) {
      fake.db.prepare('INSERT INTO geo (country, count) VALUES (?, ?)').run(c, n)
    }
    const { ctx } = makeCtx()
    const real = await answer(await handleGeo(new URL(`${ORIGIN}/api/geo`), fake.env, ctx))
    expect(real.body).toEqual(stub('/api/geo').body)
    expectSameContract(real, stub('/api/geo'))
  })

  it('/api/timeseries — echoes the range, points as AE answers them', async () => {
    stubCache()
    for (const range of ['24h', '7d', '30d', 'all', 'junk']) {
      const q = `/api/timeseries?metric=geo&range=${range}`
      const fakeAnswer = stub(q)
      const rows = (fakeAnswer.body as { points: { ts: string; value: number }[] }).points
      vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: rows.map((p) => ({ ts: p.ts, value: String(p.value) })) })))
      const fake = makeEnv({ CF_ACCOUNT_ID: 'acct', AE_API_TOKEN: 'token' })
      const { ctx } = makeCtx()
      const real = await answer(await handleTimeseries(new URL(`${ORIGIN}${q}`), fake.env, ctx))
      expectSameContract(real, fakeAnswer)
      expect((fakeAnswer.body as { range: string }).range).toBe((real.body as { range: string }).range)
    }
    expectSameContract(
      await answer(await handleTimeseries(new URL(`${ORIGIN}/api/timeseries?metric=nope`), makeEnv().env, makeCtx().ctx)),
      stub('/api/timeseries?metric=nope'),
    )
  })

  it('/api/views/<slug> — GET reads, POST counts', async () => {
    const fake = makeEnv()
    const url = new URL(`${ORIGIN}/api/views/velkommen`)
    const get = await answer(await handleViews(url, new Request(url), fake.env))
    const post = await answer(await handleViews(url, new Request(url, { method: 'POST', headers: BROWSER_HEADERS }), fake.env))
    expectSameContract(get, stub('/api/views/velkommen'))
    expectSameContract(post, stub('/api/views/velkommen', 'POST'))
  })

  it('/api/visit — the beacon POST', async () => {
    const fake = makeEnv()
    const url = new URL(`${ORIGIN}/api/visit`)
    const req = new Request(url, { method: 'POST', headers: BROWSER_HEADERS })
    Object.defineProperty(req, 'cf', { value: { country: 'NO', asn: 2119 } })
    const { ctx, settle } = makeCtx()
    const real = await answer(await handleVisit(url, req, fake.env, ctx))
    await settle()
    expectSameContract(real, stub('/api/visit', 'POST'))
  })

  it('/api/contact — a sent message', async () => {
    const fake = makeEnv()
    const url = new URL(`${ORIGIN}/api/contact`)
    const body = JSON.stringify({ name: 'Test Person', email: 'test@example.com', message: 'Hei! Dette er en testmelding.' })
    const req = new Request(url, { method: 'POST', headers: { ...BROWSER_HEADERS, 'content-type': 'application/json' }, body })
    expectSameContract(await answer(await handleContact(url, req, fake.env)), stub('/api/contact', 'POST'))
  })
})
