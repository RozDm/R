// Security headers and CSP, shared by the Worker and the build.
//
// HTML is served by the asset server, not the Worker, so its strict
// hash-based policy is written into each exported page at build time
// (scripts/finalize-export.mjs → withMetaCsp):
//   <meta http-equiv="Content-Security-Policy" content="script-src 'self'
//     'sha256-<each inline script>'… <Turnstile host>; …">
// 'self' covers the /_next/*.js chunks; the hashes cover the page's own
// inline scripts, computed from the exact bytes that ship.
//
// <meta> can't carry frame-ancestors (or report-uri), so every asset-server
// response also gets HEADER_CSP from public/_headers. Both policies are
// enforced; HEADER_CSP has no fetch directive that could veto the hashes.
// The Worker's own responses (/api/*, redirects) get ENFORCED_CSP: they
// parse no document, so no inline script runs against them.

// Turnstile lives at challenges.cloudflare.com — its script needs script-src,
// its iframe needs frame-src, the widget calls home over connect-src. We add
// these to every CSP unconditionally: the worker can't tell which HTML route
// renders the contact form, and the extra origin is harmless elsewhere.
const TURNSTILE_HOST = 'https://challenges.cloudflare.com'

// Trailing script origin shared by every policy. Cloudflare Web Analytics
// (static.cloudflareinsights.com) is deliberately absent: it was removed
// 2026-10-17 (docs/history.md), so a beacon the edge injects is refused.
const SCRIPT_TAIL = TURNSTILE_HOST

// Directives shared by the page policy (metaCsp) and ENFORCED_CSP; only
// script-src and reporting vary. upgrade-insecure-requests only does anything
// in a page's policy — the belt for a legacy http:// embed in a future
// markdown post (HSTS + mixed-content auto-upgrade cover most of it).
const COMMON_DIRECTIVES = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src 'self' ${TURNSTILE_HOST}`,
  `frame-src ${TURNSTILE_HOST}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
]

// The Worker's own responses (JSON, redirects): nothing executes inline, so
// 'self' alone is enough — no 'unsafe-inline'.
export const ENFORCED_CSP = [`script-src 'self' ${SCRIPT_TAIL}`, ...COMMON_DIRECTIVES].join('; ')

// Header policy for everything the asset server serves (public/_headers `/*`
// — tests/static-assets.test.ts holds the two equal) and the Worker's asset
// fallback. It stacks with each page's <meta> policy, so it must hold NO fetch
// directive (default-src, script-src…): that would block the hashed inline
// scripts. frame-ancestors lives here because <meta> ignores it.
export const HEADER_CSP = ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"].join(
  '; ',
)

// A page's own policy, written into it as <meta>. <meta> ignores
// frame-ancestors, report-uri and sandbox, so they're left out; violations
// are reported through report-to + the Reporting-Endpoints header from
// public/_headers (Chromium — verified to report from <meta> like from a
// header; Firefox/Safari only implement report-uri).
export function metaCsp(hashes: string[]): string {
  return [
    ['script-src', "'self'", ...hashes, SCRIPT_TAIL].join(' '),
    ...COMMON_DIRECTIVES.filter((d) => !d.startsWith('frame-ancestors')),
    `report-to ${CSP_REPORT_GROUP}`,
  ].join('; ')
}

const META_RE = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/g

// <head> plus the charset <meta> Next always puts first: the policy goes
// right after it — the charset must stay in the first 1,024 bytes.
const HEAD_RE = /<head>(<meta charSet="utf-8"\/>)?/gi

// The page with its hash policy at the top of <head>, before any script — a
// script ahead of it would run unchecked. Idempotent: an existing policy is
// replaced, never doubled. Throws on anything unexpected (no single <head>),
// which fails the build.
export async function withMetaCsp(html: string): Promise<string> {
  const bare = html.replace(META_RE, '')
  const heads = bare.match(HEAD_RE)?.length ?? 0
  if (heads !== 1) throw new Error(`expected one <head>, found ${heads}`)
  const csp = metaCsp(await inlineScriptHashes(bare))
  return bare.replace(HEAD_RE, (head) => `${head}<meta http-equiv="Content-Security-Policy" content="${csp}">`)
}

// What is wrong with a page's policy, if anything: no or several policies,
// one after a <script> or outside <head>, 'unsafe-inline', or an inline
// script whose hash it lacks. Used by scripts/check-csp.mjs on the build (CI, deploy) and on the
// live site (smoke.sh).
export async function cspProblems(html: string): Promise<string[]> {
  const metas = [...html.matchAll(META_RE)]
  if (metas.length !== 1) return [`${metas.length} CSP <meta> tags, want 1`]
  const at = metas[0].index ?? 0
  const firstScript = html.search(/<script\b/i)
  if ((firstScript !== -1 && firstScript < at) || !(html.indexOf('<head>') < at && at < html.indexOf('</head>'))) {
    return ['the CSP <meta> is not in <head> ahead of every <script>']
  }
  const scriptSrc = metas[0][1].split('; ').find((d) => d.startsWith('script-src '))
  if (!scriptSrc) return ['no script-src']
  const allowed = new Set(scriptSrc.split(' '))
  const problems: string[] = []
  if (allowed.has("'unsafe-inline'")) problems.push("script-src allows 'unsafe-inline'")
  for (const hash of await inlineScriptHashes(html)) {
    if (!allowed.has(hash)) problems.push(`inline script ${hash} is not in script-src`)
  }
  return problems
}

// The Worker sets these on its responses; public/_headers sets the same on
// the asset server's (X-Frame-Options on the HTML paths, the rest on `/*`) —
// tests/static-assets.test.ts compares them.
export const BASE_SECURITY_HEADERS: Record<string, string> = {
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
// The hash-based policy above is strict: if a page ever ships an inline
// script its policy lacks (an edge-injected one, say), or pulls a resource
// from a new origin, the browser blocks it and nobody finds out. metaCsp()
// therefore asks browsers to report violations (report-to + the
// Reporting-Endpoints header) to /api/csp-report, which logs one Analytics
// Engine point per violation.

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
