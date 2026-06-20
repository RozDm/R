// Cloudflare Worker for the portfolio site.
//
// Runs on every request (assets.run_worker_first = true):
//   1. Redirects HTTP -> HTTPS and onto the canonical host.
//   2. Dispatches /api/* to the route handlers in src/routes/.
//   3. Serves the Next.js static export from the ASSETS binding, adding
//      security headers (strict hash-based CSP for HTML it can read).
//
// Types for Env and the Workers runtime come from worker-configuration.d.ts,
// generated with `npm run cf-typegen` — rerun it after changing wrangler.jsonc.

import { EmailMessage } from 'cloudflare:email'
import { ENFORCED_CSP, HSTS, HTML_FALLBACK_CSP, applyBaseHeaders, inlineScriptHashes, readHtml, strictCsp } from './csp'
import { MONITORS, MONITOR_TIMEOUT_MS, STATUS_KEY, buildStatusData, detectTransitions, parseHistory } from './status'
import { buildStatusAlertMime } from './contact'
import { handleStatus } from './routes/status'
import { handleViews } from './routes/views'
import { handleGeo } from './routes/geo'
import { handleContact } from './routes/contact'
import { handleTimeseries } from './routes/timeseries'
import { handleNewsletter } from './routes/newsletter'
import { handleVisit } from './routes/visit'

const STATUS_ALERT_FROM = 'status@rozsoshnykh.no'
const STATUS_ALERT_TO = 'd.rossoshnyh@gmail.com'
// Daily prune cron pattern — must match the entry in wrangler.jsonc.
const PRUNE_CRON = '0 3 * * *'

function redirect301(target: string | null, location: string): Response {
  const response = new Response(target, {
    status: 301,
    headers: location.startsWith('http')
      ? { Location: location, 'Content-Type': 'text/html; charset=utf-8' }
      : { Location: location },
  })
  applyBaseHeaders(response.headers)
  if (!location.startsWith('http:')) response.headers.set('Strict-Transport-Security', HSTS)
  response.headers.set('Content-Security-Policy', ENFORCED_CSP)
  return response
}

// Cron: ping each monitor, record latency/status, append to rolling history.
async function runHealthChecks(env: Env): Promise<void> {
  const results = await Promise.all(
    MONITORS.map(async (monitor) => {
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
    } catch {
      // Alerting is best-effort: a send failure must not stop the status
      // snapshot from being written or block subsequent transitions.
    }
  }
}

// Daily prune of the contact table. Rate-limit windows are 10 min and 1 hour,
// so anything older is backup-only; 30 days bounds the table without losing
// recent data. Best-effort: a failed prune just delays the next attempt by
// 24 hours.
async function pruneContactRows(env: Env): Promise<void> {
  await env.METRICS.prepare("DELETE FROM contact WHERE at < datetime('now', '-30 days')")
    .run()
    .catch(() => {})
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

    // Force HTTPS (no HSTS over HTTP, per RFC 6797).
    if (url.protocol === 'http:') {
      url.protocol = 'https:'
      const target = url.toString()
      const safeTarget = target.replace(/[<>"]/g, '')
      const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Redirecting</title><meta http-equiv="refresh" content="0; url=${safeTarget}"></head><body>Redirecting to <a href="${safeTarget}">${safeTarget}</a></body></html>`
      return redirect301(body, target)
    }

    // Canonical host: collapse www and the workers.dev preview onto the apex
    // domain — avoids duplicate-content SEO hits, keeps shareable links short.
    if (url.hostname === 'www.rozsoshnykh.no' || url.hostname.endsWith('.workers.dev')) {
      url.hostname = 'rozsoshnykh.no'
      return redirect301(null, url.toString())
    }

    // The standalone status page moved to a section on the front page.
    if (url.pathname === '/status' || url.pathname === '/status/') {
      return redirect301(null, '/#status')
    }

    // /api/* dispatch — each handler returns null when the path isn't its own.
    const apiResponse =
      (await handleStatus(url, request, env, ctx)) ??
      (await handleViews(url, request, env)) ??
      (await handleGeo(url, request, env, ctx)) ??
      handleVisit(url, request, env, ctx) ??
      (await handleTimeseries(url, request, env, ctx)) ??
      (await handleNewsletter(url, request, env)) ??
      (await handleContact(url, request, env))
    if (apiResponse) return apiResponse

    // Fetch the asset with a clean request: no conditional headers (they make
    // the binding answer 304 with an empty body), identity encoding so we can
    // read the HTML.
    const asset = await env.ASSETS.fetch(
      new Request(url.toString(), { headers: { 'Accept-Encoding': 'identity' } }),
    )

    if ((asset.headers.get('content-type') || '').includes('text/html')) {
      // Visit + geo are no longer counted here — the client /api/visit beacon
      // (once per session) records both, so a multi-page visit counts once.
      const html = await readHtml(asset)
      if (html !== null) {
        const hashes = await inlineScriptHashes(html)
        const headers = new Headers(asset.headers)
        headers.delete('content-encoding')
        headers.delete('content-length')
        const response = new Response(html, {
          status: asset.status,
          statusText: asset.statusText,
          headers,
        })
        applyBaseHeaders(response.headers)
        response.headers.set('Strict-Transport-Security', HSTS)
        // Strict hash-based CSP for HTML we can read — no 'unsafe-inline'.
        response.headers.set('Content-Security-Policy', strictCsp(hashes))
        return response
      }
      // HTML we couldn't decode to hash (e.g. brotli): serve the bytes as-is
      // but keep 'unsafe-inline' so its inline scripts still run. Effectively
      // unreachable since we fetch assets as identity above.
      const response = new Response(asset.body, asset)
      applyBaseHeaders(response.headers)
      response.headers.set('Strict-Transport-Security', HSTS)
      response.headers.set('Content-Security-Policy', HTML_FALLBACK_CSP)
      return response
    }

    // Everything else: headers only, body untouched.
    const response = new Response(asset.body, asset)
    applyBaseHeaders(response.headers)
    response.headers.set('Strict-Transport-Security', HSTS)
    response.headers.set('Content-Security-Policy', ENFORCED_CSP)
    // Next emits OG images as extension-less files (out/opengraph-image), so the
    // static host can't infer the type; force image/png or crawlers ignore them.
    if (url.pathname.includes('opengraph-image')) {
      response.headers.set('Content-Type', 'image/png')
    }
    return response
  },
} satisfies ExportedHandler<Env>
