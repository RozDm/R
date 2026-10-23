// The Worker entry (src/index.ts): request dispatch, the two crons, and the
// two cached GET routes that had no route test — /api/status and
// /api/timeseries, whose "cache only a real answer" rules each fixed an
// incident (an empty snapshot or chart pinned at the edge).
import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from '../../src/index'
import { CONTACT_PRUNE_CRON } from '../../src/contact'
import { HEADER_CSP } from '../../src/csp'
import { handleStatus } from '../../src/routes/status'
import { handleTimeseries } from '../../src/routes/timeseries'
import { makeCtx, makeEnv } from './fakes'
import wranglerConfig from '../../wrangler.jsonc?raw'

const ORIGIN = 'https://rozsoshnykh.no'
const HEALTH_CRON = '*/5 * * * *'

// Edge cache stand-in: records each put's key; never hits.
const puts: string[] = []
function stubCache() {
  puts.length = 0
  vi.stubGlobal('caches', {
    default: { match: async () => undefined, put: async (key: Request) => void puts.push(key.url) },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function runCron(fake: ReturnType<typeof makeEnv>, cron: string) {
  const { ctx, settle } = makeCtx()
  await worker.scheduled!({ cron, scheduledTime: Date.now(), noRetry: () => {} } as ScheduledController, fake.env, ctx)
  await settle()
}

async function dispatch(fake: ReturnType<typeof makeEnv>, url: string, init?: RequestInit) {
  const { ctx } = makeCtx()
  return worker.fetch!(new Request(url, init) as Parameters<NonNullable<typeof worker.fetch>>[0], fake.env, ctx)
}

describe('fetch dispatch', () => {
  it('sends plain HTTP to HTTPS, without HSTS on the insecure answer', async () => {
    const res = await dispatch(makeEnv(), 'http://rozsoshnykh.no/api/status')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/api/status`)
    expect(res.headers.get('strict-transport-security')).toBeNull()
  })

  it('sends www to the apex', async () => {
    const res = await dispatch(makeEnv(), 'https://www.rozsoshnykh.no/api/geo?x=1')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/api/geo?x=1`)
    expect(res.headers.get('strict-transport-security')).toContain('max-age=')
  })

  it('answers an /api/ path no route claims with the 404 page and the _headers set', async () => {
    const res = await dispatch(makeEnv(), `${ORIGIN}/api/nope`)
    expect(res.status).toBe(404)
    expect(res.headers.get('content-security-policy')).toBe(HEADER_CSP)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('strict-transport-security')).toContain('max-age=')
  })
})

describe('daily contact prune', () => {
  it('is one of the crons wrangler.jsonc schedules', () => {
    const crons = wranglerConfig.match(/"crons":\s*(\[[^\]]*\])/)?.[1]
    expect(crons, 'crons array in wrangler.jsonc').toBeDefined()
    expect(JSON.parse(crons!)).toEqual(expect.arrayContaining([CONTACT_PRUNE_CRON, HEALTH_CRON]))
  })

  it('deletes rows past the 30 days the privacy notice promises, and only those', async () => {
    const fake = makeEnv()
    const insert = fake.db.prepare('INSERT INTO contact (at, ip, name, email, message) VALUES (?1, ?2, ?3, ?4, ?5)')
    const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
    insert.run(daysAgo(31), '203.0.113.7', 'Old', 'old@example.no', 'Gammel melding her')
    insert.run(daysAgo(29), '203.0.113.7', 'New', 'new@example.no', 'Ny melding her nå')
    await runCron(fake, CONTACT_PRUNE_CRON)
    const left = fake.db.prepare('SELECT name FROM contact').all() as { name: string }[]
    expect(left.map((r) => r.name)).toEqual(['New'])
  })
})

describe('5-minute health check', () => {
  const answer = (status: number) => vi.fn(async () => new Response('', { status }))

  it('writes a public snapshot to KV — results without monitor URLs', async () => {
    vi.stubGlobal('fetch', answer(200))
    const fake = makeEnv()
    await runCron(fake, HEALTH_CRON)
    const snap = JSON.parse(fake.kv.get('status')!)
    expect(snap.results).toEqual([{ name: 'Grafana', ok: true, status: 200, ms: expect.any(Number) }])
    expect(snap.history).toHaveLength(1)
    expect(JSON.stringify(snap)).not.toContain('grafana.net')
    expect(fake.sent).toHaveLength(0)
  })

  it('mails «nede» on the second failed probe in a row, not the first', async () => {
    vi.stubGlobal('fetch', answer(200))
    const fake = makeEnv()
    await runCron(fake, HEALTH_CRON)
    vi.stubGlobal('fetch', answer(503))
    await runCron(fake, HEALTH_CRON)
    expect(fake.sent).toHaveLength(0)
    await runCron(fake, HEALTH_CRON)
    expect(fake.sent).toHaveLength(1)
    expect(fake.sent[0].raw).toContain('Subject: Status: Grafana er nede')
  })
})

describe('/api/status', () => {
  const url = new URL(`${ORIGIN}/api/status`)

  it('serves the KV snapshot and edge-caches it', async () => {
    stubCache()
    const fake = makeEnv()
    fake.kv.set('status', '{"updatedAt":"2026-10-23T08:00:00.000Z","results":[],"history":[]}')
    const { ctx, settle } = makeCtx()
    const res = (await handleStatus(url, fake.env, ctx))!
    await settle()
    expect(await res.json()).toMatchObject({ updatedAt: '2026-10-23T08:00:00.000Z' })
    expect(puts).toEqual([url.href])
  })

  it('answers a KV failure with an empty, uncached snapshot', async () => {
    stubCache()
    const fake = makeEnv({ STATUS: { get: async () => Promise.reject(new Error('KV down')) } })
    const { ctx, settle } = makeCtx()
    const res = (await handleStatus(url, fake.env, ctx))!
    await settle()
    expect(await res.json()).toEqual({ results: [], history: [] })
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(puts).toEqual([])
  })
})

describe('/api/timeseries', () => {
  const at = (q: string) => new URL(`${ORIGIN}/api/timeseries?${q}`)
  const SECRETS = { CF_ACCOUNT_ID: 'acct', AE_API_TOKEN: 'token' }

  async function get(fake: ReturnType<typeof makeEnv>, q: string) {
    const { ctx, settle } = makeCtx()
    const res = (await handleTimeseries(at(q), fake.env, ctx))!
    await settle()
    return res
  }

  it('refuses an unknown metric', async () => {
    stubCache()
    expect((await get(makeEnv(), 'metric=nope')).status).toBe(400)
  })

  it('without the AE secrets: an empty, degraded, uncached series', async () => {
    stubCache()
    const res = await get(makeEnv(), 'metric=geo&range=24h')
    expect(await res.json()).toEqual({ metric: 'geo', range: '24h', points: [], degraded: true })
    expect(puts).toEqual([])
  })

  it('caches a real AE answer under the canonical key, junk params dropped', async () => {
    stubCache()
    const ae = vi.fn(async () => Response.json({ data: [{ ts: '2026-10-24 06:00:00', value: '2' }] }))
    vi.stubGlobal('fetch', ae)
    const res = await get(makeEnv(SECRETS), 'range=24h&x=1&metric=geo')
    expect(await res.json()).toEqual({ metric: 'geo', range: '24h', points: [{ ts: '2026-10-24 06:00:00', value: 2 }] })
    expect(puts).toEqual([`${ORIGIN}/api/timeseries?metric=geo&range=24h`])
    const [aeUrl, init] = ae.mock.calls[0] as unknown as [string, RequestInit]
    expect(aeUrl).toContain('/accounts/acct/analytics_engine/sql')
    expect(String(init.body)).toContain("blob1 = 'geo'")
  })

  it('serves an AE failure degraded and never caches it', async () => {
    stubCache()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"errors":["forbidden"]}', { status: 403 })))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await get(makeEnv(SECRETS), 'metric=geo&range=7d')
    expect(await res.json()).toEqual({ metric: 'geo', range: '7d', points: [], degraded: true })
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(puts).toEqual([])
    expect(error).toHaveBeenCalledWith('timeseries: AE returned', 403, expect.any(String))
  })
})
