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

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

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
    return response
  },
}
