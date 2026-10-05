// POST /api/csp-report — browsers report Content-Security-Policy violations
// here (strictCsp() in ../csp.ts points report-uri / report-to at it). Each
// violation becomes one Analytics Engine point (blob1 = 'csp'); D1 and KV are
// untouched, so a flood costs nothing but sampled AE writes (10M/day free).
// Read them back with the "Analytics report" workflow.
//
// Always answers 204 to a POST, even for junk: a browser's report delivery
// must never see an error it would retry, and an attacker learns nothing.
// GET gets a 405 so the smoke test can confirm the route is wired.
import { allowWrite, apiJson } from '../http'
import { CSP_REPORT_PATH, applyBaseHeaders, parseCspReports } from '../csp'

// A real report is a few hundred bytes; Reporting API batches stay well
// under this. Anything bigger is dropped unread.
const MAX_BODY_BYTES = 64 * 1024

function noContent(): Response {
  const response = new Response(null, { status: 204 })
  applyBaseHeaders(response.headers)
  return response
}

export async function handleCspReport(url: URL, request: Request, env: Env): Promise<Response | null> {
  if (url.pathname !== CSP_REPORT_PATH) return null
  if (request.method !== 'POST') return apiJson('{"error":"method not allowed"}', 405)

  if (Number(request.headers.get('content-length') ?? '0') > MAX_BODY_BYTES) return noContent()
  // Anyone can POST here; past the per-IP budget, drop reports silently.
  if (!(await allowWrite(env, request, 'csp'))) return noContent()
  const text = await request.text().catch(() => '')
  if (!text || text.length > MAX_BODY_BYTES) return noContent()

  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    return noContent()
  }

  for (const v of parseCspReports(payload, url.origin)) {
    try {
      env.METRICS_AE.writeDataPoint({
        indexes: ['csp'],
        blobs: ['csp', v.directive, v.blocked, v.page],
        doubles: [1],
      })
    } catch {}
  }
  return noContent()
}
