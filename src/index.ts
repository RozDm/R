// Cloudflare Worker for the portfolio site.
//
// Runs on every request (assets.run_worker_first = true):
//   1. Redirects HTTP -> HTTPS.
//   2. Serves the Next.js static export from the ASSETS binding.
//   3. Adds security headers. The ENFORCED CSP keeps 'unsafe-inline' (so the
//      site always works). A strict nonce-based CSP is shipped in
//      Content-Security-Policy-Report-Only so we can verify, with zero risk,
//      that every <script> receives a nonce before switching it to enforced.
//
// To inject nonces the HTML must be uncompressed for HTMLRewriter, so we ask
// the asset subrequest for identity encoding and only transform when the body
// is plain or gzip/deflate (never brotli, which we can't safely decode here).

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

// Enforced — current working policy.
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

// Report-only — strict policy under test (no 'unsafe-inline' for scripts).
function reportOnlyCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
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

function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export default {
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

    // 2. Fetch the asset, preferring identity encoding so HTMLRewriter can read it.
    const assetHeaders = new Headers(request.headers)
    assetHeaders.set('Accept-Encoding', 'identity')
    const asset = await env.ASSETS.fetch(
      new Request(url.toString(), { method: request.method, headers: assetHeaders }),
    )

    const contentType = asset.headers.get('content-type') || ''
    const encoding = asset.headers.get('content-encoding')
    const canTransform =
      contentType.includes('text/html') &&
      (!encoding || encoding === 'gzip' || encoding === 'deflate')

    if (canTransform) {
      const nonce = generateNonce()

      // Decompress gzip/deflate so the rewriter parses real markup.
      let source: Response = asset
      if (encoding === 'gzip' || encoding === 'deflate') {
        const headers = new Headers(asset.headers)
        headers.delete('content-encoding')
        headers.delete('content-length')
        source = new Response(
          asset.body ? asset.body.pipeThrough(new DecompressionStream(encoding)) : asset.body,
          { status: asset.status, statusText: asset.statusText, headers },
        )
      }

      const transformed = new HTMLRewriter()
        .on('script', {
          element(element) {
            element.setAttribute('nonce', nonce)
          },
        })
        .transform(source)

      const response = new Response(transformed.body, transformed)
      applyBaseHeaders(response.headers)
      response.headers.set('Strict-Transport-Security', HSTS)
      response.headers.set('Content-Security-Policy', ENFORCED_CSP)
      response.headers.set('Content-Security-Policy-Report-Only', reportOnlyCsp(nonce))
      return response
    }

    // 3. Everything else (assets, or HTML we won't risk transforming): headers only.
    const response = new Response(asset.body, asset)
    applyBaseHeaders(response.headers)
    response.headers.set('Strict-Transport-Security', HSTS)
    response.headers.set('Content-Security-Policy', ENFORCED_CSP)
    return response
  },
}
