// Cloudflare Worker for the portfolio site.
//
// Runs on every request (assets.run_worker_first = true). For HTML responses it
// generates a per-request CSP nonce, stamps it onto every <script> via
// HTMLRewriter, and sets a strict Content-Security-Policy using
// 'nonce-…' + 'strict-dynamic' — no 'unsafe-inline' for scripts. Scripts that
// Next.js injects at runtime (lazy chunks, the analytics beacon) are trusted
// transitively through 'strict-dynamic'. Non-HTML responses just get the
// security headers.

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

const BASE_SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
}

function buildCsp(nonce: string | null): string {
  const scriptSrc = nonce
    ? `script-src 'nonce-${nonce}' 'strict-dynamic'`
    : "script-src 'self'"
  return [
    "default-src 'self'",
    scriptSrc,
    // Inline style *attributes* (skill bars, intro stars) can't carry a nonce;
    // styles are far lower risk than scripts, so 'unsafe-inline' stays here.
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
}

function setSecurityHeaders(headers: Headers, csp: string): void {
  for (const [key, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    headers.set(key, value)
  }
  headers.set('Content-Security-Policy', csp)
}

function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const asset = await env.ASSETS.fetch(request)
    const contentType = asset.headers.get('content-type') || ''

    if (contentType.includes('text/html')) {
      const nonce = generateNonce()
      const transformed = new HTMLRewriter()
        .on('script', {
          element(element) {
            element.setAttribute('nonce', nonce)
          },
        })
        .transform(asset)
      const response = new Response(transformed.body, transformed)
      setSecurityHeaders(response.headers, buildCsp(nonce))
      return response
    }

    const response = new Response(asset.body, asset)
    setSecurityHeaders(response.headers, buildCsp(null))
    return response
  },
}
