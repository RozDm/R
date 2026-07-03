// Pure helpers for the view/geo metrics (stored in D1).

// Post slugs come from the URL — keep them boring before they touch SQL params.
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)
}

// Crawlers, previews and our own tooling shouldn't count as visitors.
const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|monitor|curl|wget|python|headless|lighthouse|smoke-test/i

export function looksLikeBot(userAgent: string | null): boolean {
  if (!userAgent) return true
  return BOT_RE.test(userAgent)
}

// Gate for the write endpoints (/api/visit, /api/contact, /api/views POST):
// only count requests that come from our own pages and not from a bot UA.
// Pure (just header inspection) so it can be unit-tested.
export function isWriteAllowed(headers: Headers): boolean {
  if (headers.get('sec-fetch-site') !== 'same-origin') return false
  if (looksLikeBot(headers.get('user-agent'))) return false
  return true
}

// ISO 3166-1 alpha-2, excluding Cloudflare's reserved pseudo-codes.
export function isCountableCountry(code: string | undefined): code is string {
  return !!code && /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1'
}

export function countriesFromRows(rows: { country: string; count: number }[]): Record<string, number> {
  const countries: Record<string, number> = {}
  for (const row of rows) {
    if (isCountableCountry(row.country) && Number.isFinite(row.count) && row.count > 0) {
      countries[row.country] = Math.floor(row.count)
    }
  }
  return countries
}
