// The /api/* answers the browser tests run against — the Worker isn't running
// in e2e; e2e/fixtures.ts routes every /api/* request here. Each answer has
// the status and JSON shape of the real route handler's (src/routes/), and
// tests/worker/api-stub.test.ts holds them to it: a handler change that
// alters an answer fails there until the stub follows. No Playwright import —
// Vitest loads this file too.

export interface StubAnswer {
  status: number
  body: string
}

const pad = (n: number) => String(n).padStart(2, '0')

// An AE bucket key ("YYYY-MM-DD HH:00:00", UTC) for the hour holding `ms`.
export const hourKey = (ms: number) => {
  const d = new Date(ms - (ms % 3_600_000))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:00:00`
}

// Above MIN_PUBLIC_VISITS (lib/geo.ts), so the counts show; a test for the
// quiet state overrides /api/geo with fewer.
export const STUB_COUNTRIES: Record<string, number> = { NO: 120, US: 9, UA: 4 }
export const STUB_MONITORS = ['NetBox', 'Grafana']

const RANGES = ['24h', '7d', '30d', 'all']

export function apiStub(url: URL, method: string, now = Date.now()): StubAnswer {
  const path = url.pathname
  const json = (body: unknown, status = 200): StubAnswer => ({ status, body: JSON.stringify(body) })

  if (path === '/api/status') {
    const up = Object.fromEntries(STUB_MONITORS.map((name) => [name, true]))
    return json({
      updatedAt: new Date(now - 60_000).toISOString(),
      results: STUB_MONITORS.map((name, i) => ({ name, ok: true, status: 200, ms: 120 + 20 * i })),
      history: [2, 1, 0].map((i) => ({ at: new Date(now - i * 300_000).toISOString(), up })),
    })
  }
  if (path === '/api/geo') return json({ countries: STUB_COUNTRIES })
  if (path === '/api/timeseries') {
    const metric = url.searchParams.get('metric')
    if (metric !== 'geo' && metric !== 'view') return json({ error: 'bad metric' }, 400)
    const asked = url.searchParams.get('range') ?? ''
    const range = RANGES.includes(asked) ? asked : '7d'
    const points = [30, 5, 2].map((h, i) => ({ ts: hourKey(now - h * 3_600_000), value: i + 1 }))
    return json({ metric, range, points })
  }
  if (/^\/api\/views\/[^/]+$/.test(path)) return json({ views: method === 'POST' ? 4 : 3 })
  if (path === '/api/visit' && method === 'POST') return json({ ok: true })
  if (path === '/api/contact' && method === 'POST') return json({ ok: true })
  return json({ error: 'not found' }, 404)
}
