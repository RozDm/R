import { test as base, expect } from '@playwright/test'

// Every test gets:
//   - /api/* stubbed with plausible data (the Worker isn't running; the
//     route tests in tests/worker/ and smoke.sh cover it);
//   - the intro marked as seen, unless a test sets `introSeen: false`;
//   - a check after the test that the page logged no console error and the
//     browser reported no CSP violation — the hash CSP and the code must
//     keep agreeing on every page.

const pad = (n: number) => String(n).padStart(2, '0')
const hourKey = (ms: number) => {
  const d = new Date(ms - (ms % 3_600_000))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:00:00`
}

export function apiStub(path: string, method: string): { status: number; body: string } {
  const now = Date.now()
  if (path === '/api/status') {
    const up = { NetBox: true, Grafana: true }
    return {
      status: 200,
      body: JSON.stringify({
        updatedAt: new Date(now - 60_000).toISOString(),
        results: [
          { name: 'NetBox', ok: true, status: 200, ms: 120 },
          { name: 'Grafana', ok: true, status: 200, ms: 140 },
        ],
        history: [0, 1, 2].map((i) => ({ at: new Date(now - i * 300_000).toISOString(), up })),
      }),
    }
  }
  if (path === '/api/geo') return { status: 200, body: JSON.stringify({ countries: { NO: 120, US: 9, UA: 4 } }) }
  if (path === '/api/timeseries') {
    const points = [2, 5, 30].map((h, i) => ({ ts: hourKey(now - h * 3_600_000), value: i + 1 }))
    return { status: 200, body: JSON.stringify({ metric: 'geo', range: '7d', points }) }
  }
  if (path.startsWith('/api/views/')) return method === 'POST' ? { status: 204, body: '' } : { status: 200, body: '{"views":3}' }
  if (path === '/api/visit') return { status: 204, body: '' }
  if (path === '/api/contact') return { status: 200, body: '{"ok":true}' }
  return { status: 404, body: '{"error":"not found"}' }
}

type Fixtures = { introSeen: boolean; pageProblems: string[] }

export const test = base.extend<Fixtures>({
  introSeen: [true, { option: true }],
  pageProblems: [
    async ({ page, introSeen }, use) => {
      const problems: string[] = []
      await page.addInitScript((seen) => {
        if (seen) {
          try {
            localStorage.setItem('intro-seen', '1')
          } catch {}
        }
        document.addEventListener('securitypolicyviolation', (e) =>
          console.error(`CSP violation: ${e.effectiveDirective} ${e.blockedURI}`),
        )
      }, introSeen)
      // Registered first, so a test's own page.route for one endpoint wins.
      await page.route('**/api/**', (route) => {
        const url = new URL(route.request().url())
        const { status, body } = apiStub(url.pathname, route.request().method())
        return route.fulfill({ status, body, contentType: 'application/json' })
      })
      page.on('console', (m) => {
        // The 404 page's own document is a 404 — expected, not a problem.
        if (m.type() === 'error' && !/status of 404/.test(m.text())) problems.push(m.text())
      })
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
      await use(problems)
      expect(problems, 'console errors / CSP violations').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
