// Cloudflare Worker for the portfolio site.
//
// Runs on every request (assets.run_worker_first = true):
//   1. Redirects HTTP -> HTTPS.
//   2. Serves the Next.js static export from the ASSETS binding.
//   3. Adds security headers (strict hash-based CSP for readable HTML).
//
// Types for Env and the Workers runtime come from worker-configuration.d.ts,
// generated with `npm run cf-typegen` — rerun it after changing wrangler.jsonc.

import { ENFORCED_CSP, HSTS, applyBaseHeaders, inlineScriptHashes, readHtml, strictCsp } from './csp'
import { MONITORS, STATUS_KEY, buildStatusData } from './status'
import { countriesFromRows, isCountableCountry, isHumanNavigation, isValidSlug, looksLikeBot } from './metrics'

function apiJson(body: string, status = 200): Response {
  const response = new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
  applyBaseHeaders(response.headers)
  response.headers.set('Strict-Transport-Security', HSTS)
  response.headers.set('Content-Security-Policy', ENFORCED_CSP)
  return response
}

// Metrics live in D1 (the STATUS KV keeps only the uptime snapshot):
// upserts are atomic, so no client-side batching or read-modify-write races,
// and the free tier allows 100k writes/day vs KV's 1000.
function recordGeo(env: Env, ctx: ExecutionContext, country: string | undefined): void {
  if (!isCountableCountry(country)) return
  ctx.waitUntil(
    env.METRICS.prepare(
      'INSERT INTO geo (country, count) VALUES (?1, 1) ON CONFLICT(country) DO UPDATE SET count = count + 1',
    )
      .bind(country)
      .run()
      .catch(() => {}),
  )
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
  const data = buildStatusData(raw, results, new Date().toISOString())
  await env.STATUS.put(STATUS_KEY, JSON.stringify(data))
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runHealthChecks(env))
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // 1. Force HTTPS (no HSTS over HTTP, per RFC 6797).
    if (url.protocol === 'http:') {
      url.protocol = 'https:'
      const target = url.toString()
      const safeTarget = target.replace(/[<>"]/g, '')
      const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Redirecting</title><meta http-equiv="refresh" content="0; url=${safeTarget}"></head><body>Redirecting to <a href="${safeTarget}">${safeTarget}</a></body></html>`
      const redirect = new Response(body, {
        status: 301,
        headers: { Location: target, 'Content-Type': 'text/html; charset=utf-8' },
      })
      applyBaseHeaders(redirect.headers)
      redirect.headers.set('Content-Security-Policy', ENFORCED_CSP)
      return redirect
    }

    // 1a. Canonical host: collapse www and the workers.dev preview onto the
    //     apex domain. One canonical host avoids duplicate-content SEO hits
    //     and keeps shareable links short.
    if (url.hostname === 'www.rozsoshnykh.no' || url.hostname.endsWith('.workers.dev')) {
      url.hostname = 'rozsoshnykh.no'
      const target = url.toString()
      const redirect = new Response(null, { status: 301, headers: { Location: target } })
      applyBaseHeaders(redirect.headers)
      redirect.headers.set('Strict-Transport-Security', HSTS)
      redirect.headers.set('Content-Security-Policy', ENFORCED_CSP)
      return redirect
    }

    // 1b. The standalone status page moved to a section on the front page;
    //     keep old links alive.
    if (url.pathname === '/status' || url.pathname === '/status/') {
      const redirect = new Response(null, { status: 301, headers: { Location: '/#status' } })
      applyBaseHeaders(redirect.headers)
      redirect.headers.set('Strict-Transport-Security', HSTS)
      redirect.headers.set('Content-Security-Policy', ENFORCED_CSP)
      return redirect
    }

    // 1c. Uptime API: serve the latest health snapshot from KV.
    if (url.pathname === '/api/status') {
      let body = '{"results":[],"history":[]}'
      try {
        body = (await env.STATUS.get(STATUS_KEY)) || body
      } catch {}
      return apiJson(body)
    }

    // 1d. Per-post view counter (D1). GET reads, POST counts one view — only
    //     the page's own same-origin fetch() counts, so plain crawlers and
    //     external spam don't inflate it.
    const viewsMatch = url.pathname.match(/^\/api\/views\/([^/]+)$/)
    if (viewsMatch) {
      const slug = viewsMatch[1]
      if (!isValidSlug(slug)) return apiJson('{"error":"bad slug"}', 400)
      if (
        request.method === 'POST' &&
        request.headers.get('sec-fetch-site') === 'same-origin' &&
        !looksLikeBot(request.headers.get('user-agent'))
      ) {
        const row = await env.METRICS.prepare(
          'INSERT INTO views (slug, count) VALUES (?1, 1) ON CONFLICT(slug) DO UPDATE SET count = count + 1 RETURNING count',
        )
          .bind(slug)
          .first<{ count: number }>()
          .catch(() => null)
        if (row) return apiJson(JSON.stringify({ views: row.count }))
      }
      const row = await env.METRICS.prepare('SELECT count FROM views WHERE slug = ?1')
        .bind(slug)
        .first<{ count: number }>()
        .catch(() => null)
      return apiJson(JSON.stringify({ views: row?.count ?? 0 }))
    }

    // 1e. Visitor countries (D1), aggregated by recordGeo() below.
    if (url.pathname === '/api/geo') {
      const rows = await env.METRICS.prepare('SELECT country, count FROM geo')
        .all<{ country: string; count: number }>()
        .catch(() => null)
      return apiJson(JSON.stringify({ countries: countriesFromRows(rows?.results ?? []) }))
    }

    // 2. Fetch the asset with a clean request: no conditional headers (they make
    //    the binding answer 304 with an empty body), identity encoding so we can
    //    read the HTML.
    const asset = await env.ASSETS.fetch(
      new Request(url.toString(), { headers: { 'Accept-Encoding': 'identity' } }),
    )

    if ((asset.headers.get('content-type') || '').includes('text/html')) {
      // Geo stats: only human-looking page navigations count.
      if (asset.status === 200 && isHumanNavigation(request.headers)) {
        recordGeo(env, ctx, request.cf?.country)
      }
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
        // Strict CSP is now ENFORCED for HTML we can read; the asset fallback
        // below still serves ENFORCED_CSP (with 'unsafe-inline') so brotli or
        // any other path we can't hash stays working.
        response.headers.set('Content-Security-Policy', strictCsp(hashes))
        return response
      }
    }

    // 3. Everything else: headers only, body untouched.
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
