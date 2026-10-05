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
import { CSP_REPORT_GROUP, CSP_REPORT_PATH, ENFORCED_CSP, HSTS, HTML_FALLBACK_CSP, applyBaseHeaders, cacheControlFor, inlineScriptHashes, readHtml, strictCsp } from './csp'
import { MONITORS, MONITOR_TIMEOUT_MS, STATUS_KEY, buildStatusData, detectTransitions, parseHistory } from './status'
import { CONTACT_WINDOWS_MS, buildStatusAlertMime, isoCutoff } from './contact'
import { handleStatus } from './routes/status'
import { handleViews } from './routes/views'
import { handleGeo } from './routes/geo'
import { handleContact } from './routes/contact'
import { handleTimeseries } from './routes/timeseries'
import { handleVisit } from './routes/visit'
import { handleCspReport } from './routes/csp-report'

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
      (await handleStatus(url, env, ctx)) ??
      (await handleViews(url, request, env)) ??
      (await handleGeo(url, env, ctx)) ??
      (await handleVisit(url, request, env, ctx)) ??
      (await handleTimeseries(url, env, ctx)) ??
      (await handleContact(url, request, env)) ??
      (await handleCspReport(url, request, env))
    if (apiResponse) return apiResponse

    // Clients that ask for /favicon.ico directly (RSS readers, link unfurlers,
    // bookmarks) get the build-time ICO from app/icons/[name]/route.tsx.
    if (url.pathname === '/favicon.ico') url.pathname = '/icons/favicon.ico'

    // Fetch the asset with a clean request: no conditional headers (they make
    // the binding answer 304 with an empty body), identity encoding so we can
    // read the HTML. redirect: 'manual' — a Request built here follows
    // redirects by default, which silently served /blogg as a 200 duplicate
    // of /blogg/ instead of passing on the binding's trailing-slash redirect.
    const asset = await env.ASSETS.fetch(
      new Request(url.toString(), { headers: { 'Accept-Encoding': 'identity' }, redirect: 'manual' }),
    )

    // html_handling redirects (/blogg → /blogg/, /x/index.html → /x/) come
    // back as 307s; they're permanent, so hand them on as 301s.
    const assetLocation = asset.headers.get('location')
    if (asset.status >= 300 && asset.status < 400 && assetLocation) {
      return redirect301(null, new URL(assetLocation, url).toString())
    }

    if ((asset.headers.get('content-type') || '').includes('text/html')) {
      // Visit + geo are no longer counted here — the client /api/visit beacon
      // (once per session) records both, so a multi-page visit counts once.
      const raw = await readHtml(asset)
      // One root layout serves both languages, so every exported page says
      // <html lang="nb">; /en/ documents are English (the client keeps it in
      // sync on later navigations — components/effects/HtmlLang.tsx).
      const html =
        raw !== null && (url.pathname === '/en' || url.pathname.startsWith('/en/'))
          ? raw.replace('<html lang="nb"', '<html lang="en"')
          : raw
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
        // Where the policy's report-to group delivers (Reporting API).
        response.headers.set('Reporting-Endpoints', `${CSP_REPORT_GROUP}="${url.origin}${CSP_REPORT_PATH}"`)
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
    // Let the browser keep content-hashed build output (and the big, stable
    // world map / flag font) instead of re-downloading them every visit; the
    // Assets binding otherwise tags everything must-revalidate. HTML is handled
    // above and stays fresh.
    const cacheControl = cacheControlFor(url.pathname)
    if (cacheControl) response.headers.set('Cache-Control', cacheControl)
    // Next emits OG images as extension-less files (out/opengraph-image), so the
    // static host can't infer the type; force image/png or crawlers ignore them.
    if (url.pathname.includes('opengraph-image')) {
      response.headers.set('Content-Type', 'image/png')
    }
    return response
  },
} satisfies ExportedHandler<Env>
