// Cloudflare Worker for the portfolio site.
//
// Runs on every request (assets.run_worker_first = true):
//   1. Redirects HTTP -> HTTPS.
//   2. Serves the Next.js static export from the ASSETS binding.
//   3. Adds security headers.
//
// For HTML the Worker can read, it ships a strict hash-based CSP:
//   script-src 'self' 'sha256-<each inline script>'… <beacon-host>
// 'self' covers the /_next/*.js chunks; the per-response hashes cover the
// inline scripts. Hashes are computed from the exact HTML being served, so
// they are always self-consistent and independent of build determinism.
//
// For anything else (assets, or HTML in an encoding we can't decode), the
// Worker falls back to the previous policy that keeps 'unsafe-inline' as a
// safety net so the site never breaks.

interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  STATUS: KVNamespace
}

// Endpoints the uptime cron checks. Add your own services here.
// `internal: true` checks via the ASSETS binding (a Worker can't fetch its own
// public URL — Cloudflare blocks the loop). External services use plain fetch.
const MONITORS: { name: string; url: string; internal?: boolean }[] = [
  { name: 'Nettsted', url: 'https://d.rozsoshnykh.workers.dev/', internal: true },
]

const STATUS_KEY = 'status'
const HISTORY_LIMIT = 96 // ~8h at one check / 5 min

const ENFORCED_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' https://cloudflareinsights.com https://static.cloudflareinsights.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ')

function strictCsp(hashes: string[]): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')} https://static.cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' https://cloudflareinsights.com https://static.cloudflareinsights.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
}

const BASE_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
}

const HSTS = 'max-age=63072000; includeSubDomains; preload'

function applyBaseHeaders(headers: Headers): void {
  for (const [key, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    headers.set(key, value)
  }
}

// Read HTML as text, decompressing gzip/deflate ourselves. null for brotli/etc.
async function readHtml(asset: Response): Promise<string | null> {
  const encoding = asset.headers.get('content-encoding')
  if (!encoding) return await asset.text()
  if ((encoding === 'gzip' || encoding === 'deflate') && asset.body) {
    return await new Response(asset.body.pipeThrough(new DecompressionStream(encoding))).text()
  }
  return null
}

// sha256 (base64) source expressions for every inline <script> in the HTML.
async function inlineScriptHashes(html: string): Promise<string[]> {
  const matches = html.matchAll(/<script\b(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)
  const hashes = new Set<string>()
  for (const match of matches) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(match[1]))
    let binary = ''
    for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte)
    hashes.add(`'sha256-${btoa(binary)}'`)
  }
  return [...hashes]
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
          : await fetch(monitor.url, { method: 'GET', redirect: 'manual' })
        status = res.status
        ok = res.status >= 200 && res.status < 400
      } catch {
        ok = false
      }
      return { name: monitor.name, url: monitor.url, ok, status, ms: Date.now() - start }
    }),
  )

  const updatedAt = new Date().toISOString()
  let data: { updatedAt: string; results: typeof results; history: { at: string; up: boolean }[] }
  try {
    const raw = await env.STATUS.get(STATUS_KEY)
    data = raw ? JSON.parse(raw) : { updatedAt, results, history: [] }
  } catch {
    data = { updatedAt, results, history: [] }
  }
  data.updatedAt = updatedAt
  data.results = results
  data.history = Array.isArray(data.history) ? data.history : []
  data.history.push({ at: updatedAt, up: results.every((r) => r.ok) })
  while (data.history.length > HISTORY_LIMIT) data.history.shift()

  await env.STATUS.put(STATUS_KEY, JSON.stringify(data))
}

export default {
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<void> {
    ctx.waitUntil(runHealthChecks(env))
  },

  async fetch(request: Request, env: Env): Promise<Response> {
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

    // 1b. Uptime API: serve the latest health snapshot from KV.
    if (url.pathname === '/api/status') {
      let body = '{"results":[],"history":[]}'
      try {
        body = (await env.STATUS.get(STATUS_KEY)) || body
      } catch {}
      const response = new Response(body, {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      })
      applyBaseHeaders(response.headers)
      response.headers.set('Strict-Transport-Security', HSTS)
      response.headers.set('Content-Security-Policy', ENFORCED_CSP)
      return response
    }

    // 2. Fetch the asset with a clean request: no conditional headers (they make
    //    the binding answer 304 with an empty body), identity encoding so we can
    //    read the HTML.
    const asset = await env.ASSETS.fetch(
      new Request(url.toString(), { headers: { 'Accept-Encoding': 'identity' } }),
    )

    if ((asset.headers.get('content-type') || '').includes('text/html')) {
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
}
