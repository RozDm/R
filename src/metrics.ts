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

// A real browser opening a page sends Sec-Fetch-Mode: navigate; scanners
// that fake a Chrome User-Agent almost never bother. New domains get
// hammered by CT-log scanners, so this gate keeps them out of the stats.
export function isHumanNavigation(headers: Headers): boolean {
  if (looksLikeBot(headers.get('user-agent'))) return false
  return headers.get('sec-fetch-mode') === 'navigate'
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
