// Cloudflare Worker for the portfolio site.
//
// Phase 1: hybrid setup. All requests go through this Worker, which falls
// through to the assets binding (Next.js static export in ./out) and adds
// strict security headers to every response.
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

const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Content-Security-Policy': CSP,
}

function withSecurityHeaders(response: Response): Response {
  const next = new Response(response.body, response)
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    next.headers.set(key, value)
  }
  return next
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Force HTTPS — *.workers.dev is reachable over plain HTTP without an
    // automatic redirect. Loop-safe: only redirects when the request URL is
    // actually http (after the redirect it is https, so it won't match again).
    const url = new URL(request.url)
    if (url.protocol === 'http:') {
      url.protocol = 'https:'
      return Response.redirect(url.toString(), 301)
    }

    // Future API routes will be dispatched here before falling through to
    // the static assets:
    //   if (url.pathname.startsWith('/api/')) { ... }

    const asset = await env.ASSETS.fetch(request)
    return withSecurityHeaders(asset)
  },
}
