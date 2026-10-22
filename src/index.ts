// Cloudflare Worker for the portfolio site.
//
// Runs only for /api/* and the MTA-STS policy (assets.run_worker_first in
// wrangler.jsonc). Pages and files are served by the asset server straight
// from the static export, with their headers from public/_headers, each
// page's hash CSP baked in at build (scripts/finalize-export.mjs), and the
// redirects in out/_redirects and the zone (zone-rules.yml) — none of it
// costs a Worker request, and it keeps working when the free plan's 100k
// requests/day run out. Here:
//   1. HTTPS, then /.well-known/mta-sts.txt on any host (routes/mta-sts.ts).
//   2. Canonical host for the API (www, mta-sts → apex).
//   3. Dispatches /api/* to the route handlers in src/routes/.
//   4. An /api/ path no route claims gets the asset server's 404 page.
//
// Types for Env and the Workers runtime come from worker-configuration.d.ts,
// generated with `npm run cf-typegen` — rerun it after changing wrangler.jsonc.

import { EmailMessage } from 'cloudflare:email'
import { ENFORCED_CSP, HEADER_CSP, HSTS, applyBaseHeaders } from './csp'
import { MONITOR_TIMEOUT_MS, STATUS_KEY, buildStatusData, detectTransitions, monitors, parseHistory } from './status'
import { CONTACT_WINDOWS_MS, buildStatusAlertMime, isoCutoff } from './contact'
import { handleStatus } from './routes/status'
import { handleViews } from './routes/views'
import { handleGeo } from './routes/geo'
import { handleContact } from './routes/contact'
import { handleTimeseries } from './routes/timeseries'
import { handleVisit } from './routes/visit'
import { handleCspReport } from './routes/csp-report'
import { handleMtaSts } from './routes/mta-sts'

const STATUS_ALERT_FROM = 'status@rozsoshnykh.no'
const STATUS_ALERT_TO = 'd.rossoshnyh@gmail.com'
// Daily prune cron pattern — must match the entry in wrangler.jsonc.
const PRUNE_CRON = '0 3 * * *'

// `secure` flags whether the incoming request was HTTPS. Per RFC 6797, HSTS
// must not be emitted on responses to plain-HTTP requests (the client is
// required to ignore it anyway). Defaults true; the HTTP→HTTPS redirect
// passes false explicitly.
function redirect301(target: string | null, location: string, secure = true): Response {
  const response = new Response(target, {
    status: 301,
    headers: location.startsWith('http')
      ? { Location: location, 'Content-Type': 'text/html; charset=utf-8' }
      : { Location: location },
  })
  applyBaseHeaders(response.headers)
  if (secure) response.headers.set('Strict-Transport-Security', HSTS)
  response.headers.set('Content-Security-Policy', ENFORCED_CSP)
  return response
}

// Cron: ping each monitor, record latency/status, append to rolling history.
async function runHealthChecks(env: Env): Promise<void> {
  const results = await Promise.all(
    monitors(env).map(async (monitor) => {
      const start = Date.now()
      let ok = false
      let status = 0
      try {
        const res = monitor.internal
          ? await env.ASSETS.fetch(new Request(monitor.url))
          : await fetch(monitor.url, {
              method: 'GET',
              // Follow redirects (NetBox sends / to /login/) and require a
              // clean 200 on the final response — 3xx/4xx/5xx count as down.
              redirect: 'follow',
              // Bound the probe so a hung host is recorded as down, not waited on.
              signal: AbortSignal.timeout(MONITOR_TIMEOUT_MS),
              headers: {
                'User-Agent': 'StatusMonitor/1.0 (+https://rozsoshnykh.no/status)',
              },
            })
        status = res.status
        ok = res.status === 200
      } catch {
        ok = false
      }
      return { name: monitor.name, url: monitor.url, ok, status, ms: Date.now() - start }
    }),
  )

  const raw = await env.STATUS.get(STATUS_KEY).catch(() => null)
  const previousHistory = parseHistory(raw)
  const transitions = detectTransitions(previousHistory, results)
  const updatedAt = new Date().toISOString()
  const data = buildStatusData(raw, results, updatedAt)
  await env.STATUS.put(STATUS_KEY, JSON.stringify(data))

  for (const t of transitions) {
    try {
      const mime = buildStatusAlertMime(STATUS_ALERT_FROM, STATUS_ALERT_TO, t, updatedAt)
      await env.CONTACT_EMAIL.send(new EmailMessage(STATUS_ALERT_FROM, STATUS_ALERT_TO, mime))
    } catch (err) {
      // Alerting is best-effort: a send failure must not stop the status
      // snapshot from being written or block subsequent transitions — but
      // it must show up in Workers Logs, or a dead alert path goes unnoticed.
      console.error('status: alert mail failed', t.name, err)
    }
  }
}

// Daily prune of the contact table. Rate-limit windows are 10 min and 1 hour,
// so anything older is backup-only; 30 days bounds the table without losing
// recent data. Best-effort: a failed prune just delays the next attempt by
// 24 hours. The cutoff is an ISO string like `at` (see CONTACT_WINDOWS_MS).
async function pruneContactRows(env: Env): Promise<void> {
  await env.METRICS.prepare('DELETE FROM contact WHERE at < ?1')
    .bind(isoCutoff(Date.now(), CONTACT_WINDOWS_MS.retention))
    .run()
    .catch((err) => console.error('prune: contact delete failed', err))
}

export default {
  async scheduled(controller, env, ctx) {
    if (controller.cron === PRUNE_CRON) {
      ctx.waitUntil(pruneContactRows(env))
    } else {
      ctx.waitUntil(runHealthChecks(env))
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // Force HTTPS. Per RFC 6797 the HSTS header on this plain-HTTP response
    // must be suppressed — clients are required to ignore it anyway.
    if (url.protocol === 'http:') {
      url.protocol = 'https:'
      const target = url.toString()
      const safeTarget = target.replace(/[<>"]/g, '')
      const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Redirecting</title><meta http-equiv="refresh" content="0; url=${safeTarget}"></head><body>Redirecting to <a href="${safeTarget}">${safeTarget}</a></body></html>`
      return redirect301(body, target, false)
    }

    // The MTA-STS policy, before the host checks: senders fetch it from
    // mta-sts.rozsoshnykh.no and must get it there, never a redirect.
    const policy = await handleMtaSts(url)
    if (policy) return policy

    // Canonical host for the API. www (and mta-sts, but for its policy) is
    // redirected at the edge (Single Redirect, zone-rules.yml) before it gets
    // here — this is the backstop. workers.dev is off (wrangler.jsonc).
    if (url.hostname === 'www.rozsoshnykh.no' || url.hostname === 'mta-sts.rozsoshnykh.no') {
      url.hostname = 'rozsoshnykh.no'
      return redirect301(null, url.toString())
    }

    // /api/* dispatch — each handler returns null when the path isn't its own.
    const apiResponse =
      (await handleStatus(url, env, ctx)) ??
      (await handleViews(url, request, env)) ??
      (await handleGeo(url, env, ctx)) ??
      (await handleVisit(url, request, env, ctx)) ??
      (await handleTimeseries(url, env, ctx)) ??
      (await handleContact(url, request, env)) ??
      (await handleCspReport(url, request, env))
    if (apiResponse) return apiResponse

    // An /api/ path no route claims: the asset server's 404 page. _headers
    // never applies to a Worker response, so the headers it would have had
    // are set here; HEADER_CSP, not ENFORCED_CSP — the page's own <meta>
    // policy holds the hashes its inline scripts need.
    const asset = await env.ASSETS.fetch(request)
    const response = new Response(asset.body, asset)
    applyBaseHeaders(response.headers)
    response.headers.set('Strict-Transport-Security', HSTS)
    response.headers.set('Content-Security-Policy', HEADER_CSP)
    return response
  },
} satisfies ExportedHandler<Env>
