// Cloudflare Worker for the portfolio site.
//
// Runs on every request (assets.run_worker_first = true). Redirects HTTP to
// HTTPS, then serves the Next.js static export from the ASSETS binding with a
// strict set of security headers.
//
// Future phases will add /api/* endpoints (view counter, contact form,
// GitHub stats) on top of the same structure.

interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>
  }
}

const CSP = [
  "default-src 'self'",
  // 'unsafe-inline' is needed for Next's runtime inline scripts and our
  // theme/intro init snippets. Tightenable later via hashes or nonces.
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

// Safe to send over both HTTP and HTTPS.
const BASE_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Content-Security-Policy': CSP,
}

// HSTS must only ever be returned over HTTPS (RFC 6797), so it is applied
// separately — never on the HTTP redirect.
const HSTS = 'max-age=63072000; includeSubDomains; preload'

function applyBaseHeaders(headers: Headers): void {
  for (const [key, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    headers.set(key, value)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Force HTTPS — *.workers.dev is reachable over plain HTTP without an
    // automatic redirect. Loop-safe: only fires when the request URL is
    // actually http. The 301 carries an HTML body + the base security headers,
    // but NOT HSTS (which is invalid over HTTP).
    if (url.protocol === 'http:') {
      url.protocol = 'https:'
      const target = url.toString()
      const safeTarget = target.replace(/[<>"]/g, '')
      const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Redirecting</title><meta http-equiv="refresh" content="0; url=${safeTarget}"></head><body>Redirecting to <a href="${safeTarget}">${safeTarget}</a></body></html>`
      const response = new Response(body, {
        status: 301,
        headers: {
          Location: target,
          'Content-Type': 'text/html; charset=utf-8',
        },
      })
      applyBaseHeaders(response.headers)
      return response
    }

    // Future API routes will be dispatched here before falling through to
    // the static assets:
    //   if (url.pathname.startsWith('/api/')) { ... }

    const asset = await env.ASSETS.fetch(request)
    const response = new Response(asset.body, asset)
    applyBaseHeaders(response.headers)
    response.headers.set('Strict-Transport-Security', HSTS) // HTTPS only
    return response
  },
}
