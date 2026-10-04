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
// upgrade-insecure-requests lives here so strictCsp — the policy real HTML
// pages actually get, the only place the directive can do anything — carries
// it too; it used to sit only on the two constants below, where no document
// renders. HSTS + modern mixed-content auto-upgrade already cover most of it;
// this is the belt for a legacy http:// embed in a future markdown post.
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
  'upgrade-insecure-requests',
]

// Fallback for non-HTML assets and redirects: nothing executes inline here, so
// 'self' alone is enough — no 'unsafe-inline'.
export const ENFORCED_CSP = [`script-src 'self' ${SCRIPT_TAIL}`, ...COMMON_DIRECTIVES].join('; ')

// Last resort for HTML we couldn't decode (e.g. an encoding we can't
// decompress): keep 'unsafe-inline' so its inline scripts still run. Should be
// effectively unreachable since assets are fetched as identity.
export const HTML_FALLBACK_CSP = [
  `script-src 'self' 'unsafe-inline' ${SCRIPT_TAIL}`,
  ...COMMON_DIRECTIVES,
].join('; ')

// Only real HTML pages report violations (see CSP_REPORT_PATH below): that
// is where a missed inline-script hash would break the site.
export function strictCsp(hashes: string[]): string {
  return [
    `script-src 'self' ${hashes.join(' ')} ${SCRIPT_TAIL}`,
    ...COMMON_DIRECTIVES,
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_REPORT_GROUP}`,
  ].join('; ')
}

// Browser cache policy for static assets the Worker serves.
//
// Cloudflare's Workers Assets binding tags every file `max-age=0,
// must-revalidate`, and this Worker re-fetches assets without forwarding the
// client's If-None-Match — so a repeat visit or a client-side navigation never
// gets a 304 and re-downloads every chunk in full. That's wasteful for the two
// classes of asset below; HTML deliberately stays no-cache (per-request
// hash-CSP means every document is built fresh).
//
//   /_next/static/*  content-hashed build output (JS, CSS, next/font woff2) —
//                    the filename changes when the bytes do, so `immutable`
//                    is always safe and the browser stops revalidating.
//   /world.svg,      large, rarely-changing client-fetched assets (the 96 kB
//   /fonts/*,        world map, the 78 kB flag font, the PNG app icons). A
//   /icons/*         week's cache spares returning visitors the re-download;
//                    all self-heal within a week of any change since their
//                    URLs are stable.
//
// Content-addressed URLs make this security-neutral — CSP still gates what may
// load; caching only affects whether the browser re-fetches identical bytes.
export function cacheControlFor(pathname: string): string | null {
  if (pathname.startsWith('/_next/static/')) return 'public, max-age=31536000, immutable'
  if (pathname === '/world.svg' || pathname.startsWith('/fonts/') || pathname.startsWith('/icons/')) {
    return 'public, max-age=604800'
  }
  return null
}

const BASE_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // browsing-topics is the Topics API that replaced FLoC; the old
  // interest-cohort token is unknown to current Chrome and only logged a
  // console error on every page.
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  // Isolates the top-level browsing context: a popup opened by the page can't
  // reach window.opener back into us. Our LinkedIn share link already sets
  // rel="noopener", so this is defence-in-depth for any future popup. Safe
  // alongside Turnstile (iframes aren't affected by COOP).
  'Cross-Origin-Opener-Policy': 'same-origin',
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

// --- CSP violation reports --------------------------------------------------
//
// The hash-based policy above is strict: if a build ever ships an inline
// script the Worker fails to hash, or a page pulls a resource from a new
// origin, the browser silently blocks it and nobody finds out. strictCsp()
// therefore asks browsers to report violations (report-uri for Firefox/Safari,
// report-to + the Reporting-Endpoints header for Chromium) to
// /api/csp-report, which logs one Analytics Engine point per violation.

export const CSP_REPORT_PATH = '/api/csp-report'
export const CSP_REPORT_GROUP = 'csp-endpoint'

export interface CspViolation {
  directive: string // e.g. script-src-elem
  blocked: string // an origin, or a keyword: inline / eval / data / blob
  page: string // pathname of the document that was blocked
}

// Browser extensions inject scripts and styles the policy rightly blocks;
// those reports say nothing about the site, so they are dropped.
const EXTENSION_RE = /^(chrome|moz|safari(-web)?|ms-browser)-extension:/i

function blockedKey(raw: string): string {
  if (!raw) return 'unknown'
  if (/^[a-z-]+$/i.test(raw)) return raw.toLowerCase().slice(0, 32) // inline, eval, self…
  try {
    const u = new URL(raw)
    if (u.protocol === 'data:' || u.protocol === 'blob:') return u.protocol.slice(0, -1)
    return u.origin.slice(0, 96)
  } catch {
    return raw.slice(0, 64)
  }
}

// Normalise both report formats into a short, PII-free list: the legacy
// report-uri body ({"csp-report": {...}}) and the Reporting API batch
// ([{type: "csp-violation", body: {...}}]). Only reports about documents on
// `origin` are kept — anything else is someone POSTing junk at the endpoint.
// Origins and paths only: no query strings, no full URLs, no user agent.
export function parseCspReports(payload: unknown, origin: string, max = 10): CspViolation[] {
  const raw: { doc?: unknown; blocked?: unknown; directive?: unknown }[] = []
  if (Array.isArray(payload)) {
    for (const r of payload) {
      if (typeof r !== 'object' || r === null) continue
      const { type, body } = r as { type?: unknown; body?: unknown }
      if (type !== 'csp-violation' || typeof body !== 'object' || body === null) continue
      const b = body as Record<string, unknown>
      raw.push({ doc: b.documentURL, blocked: b.blockedURL, directive: b.effectiveDirective })
    }
  } else if (typeof payload === 'object' && payload !== null) {
    const b = (payload as Record<string, unknown>)['csp-report']
    if (typeof b === 'object' && b !== null) {
      const r = b as Record<string, unknown>
      raw.push({
        doc: r['document-uri'],
        blocked: r['blocked-uri'],
        directive: r['effective-directive'] ?? r['violated-directive'],
      })
    }
  }

  const out: CspViolation[] = []
  for (const r of raw) {
    if (out.length >= max) break
    if (typeof r.doc !== 'string') continue
    let doc: URL
    try {
      doc = new URL(r.doc)
    } catch {
      continue
    }
    if (doc.origin !== origin) continue
    const blockedRaw = typeof r.blocked === 'string' ? r.blocked : ''
    if (EXTENSION_RE.test(blockedRaw)) continue
    const directive =
      typeof r.directive === 'string' ? (r.directive.split(/\s+/)[0] || 'unknown').slice(0, 48) : 'unknown'
    out.push({ directive, blocked: blockedKey(blockedRaw), page: doc.pathname.slice(0, 128) })
  }
  return out
}
