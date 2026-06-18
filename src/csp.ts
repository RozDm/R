// Security headers and CSP helpers for the Worker.
//
// For HTML the Worker can read, it ships a strict hash-based CSP:
//   script-src 'self' 'sha256-<each inline script>'… <beacon-host>
// 'self' covers the /_next/*.js chunks; the per-response hashes cover the
// inline scripts. Hashes are computed from the exact HTML being served, so
// they are always self-consistent and independent of build determinism.
//
// Non-HTML responses (assets, redirects) parse no document, so no inline
// script ever executes against them — their fallback CSP needs no
// 'unsafe-inline' (ENFORCED_CSP). The only place that still needs it is HTML
// we could not decode to hash; HTML_FALLBACK_CSP covers that rare case so the
// page never breaks, while keeping 'unsafe-inline' off every other response.

// Turnstile lives at challenges.cloudflare.com — its script needs script-src,
// its iframe needs frame-src, the widget calls home over connect-src. We add
// these to every CSP unconditionally: the worker can't tell which HTML route
// renders the contact form, and the extra origin is harmless elsewhere.
const TURNSTILE_HOST = 'https://challenges.cloudflare.com'

// Trailing script origins shared by every policy (beacon + Turnstile).
const SCRIPT_TAIL = `https://static.cloudflareinsights.com ${TURNSTILE_HOST}`

// Directives identical across all three policies; only script-src varies.
const COMMON_DIRECTIVES = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src 'self' https://cloudflareinsights.com https://static.cloudflareinsights.com ${TURNSTILE_HOST}`,
  `frame-src ${TURNSTILE_HOST}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]

// Fallback for non-HTML assets and redirects: nothing executes inline here, so
// 'self' alone is enough — no 'unsafe-inline'.
export const ENFORCED_CSP = [
  `script-src 'self' ${SCRIPT_TAIL}`,
  ...COMMON_DIRECTIVES,
  'upgrade-insecure-requests',
].join('; ')

// Last resort for HTML we couldn't decode (e.g. an encoding we can't
// decompress): keep 'unsafe-inline' so its inline scripts still run. Should be
// effectively unreachable since assets are fetched as identity.
export const HTML_FALLBACK_CSP = [
  `script-src 'self' 'unsafe-inline' ${SCRIPT_TAIL}`,
  ...COMMON_DIRECTIVES,
  'upgrade-insecure-requests',
].join('; ')

export function strictCsp(hashes: string[]): string {
  return [`script-src 'self' ${hashes.join(' ')} ${SCRIPT_TAIL}`, ...COMMON_DIRECTIVES].join('; ')
}

const BASE_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
}

export const HSTS = 'max-age=63072000; includeSubDomains; preload'

export function applyBaseHeaders(headers: Headers): void {
  for (const [key, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    headers.set(key, value)
  }
}

// Read HTML as text, decompressing gzip/deflate ourselves. null for brotli/etc.
export async function readHtml(asset: Response): Promise<string | null> {
  const encoding = asset.headers.get('content-encoding')
  if (!encoding) return await asset.text()
  if ((encoding === 'gzip' || encoding === 'deflate') && asset.body) {
    return await new Response(asset.body.pipeThrough(new DecompressionStream(encoding))).text()
  }
  return null
}

// sha256 (base64) source expressions for every inline <script> in the HTML.
export async function inlineScriptHashes(html: string): Promise<string[]> {
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
