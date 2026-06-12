// Pure helpers for the views / geo counters stored in KV.

export const VIEWS_PREFIX = 'views:'
export const GEO_KEY = 'geo'

// Post slugs come from the URL — keep them boring before they touch KV keys.
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)
}

export function parseCount(raw: string | null): number {
  const n = raw === null ? 0 : Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export interface GeoData {
  countries: Record<string, number>
}

export function parseGeo(raw: string | null): GeoData {
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      const countries = (parsed as { countries?: unknown }).countries
      if (countries && typeof countries === 'object') {
        const clean: Record<string, number> = {}
        for (const [code, count] of Object.entries(countries as Record<string, unknown>)) {
          if (/^[A-Z]{2}$/.test(code) && typeof count === 'number' && count > 0) {
            clean[code] = Math.floor(count)
          }
        }
        return { countries: clean }
      }
    } catch {}
  }
  return { countries: {} }
}

// Returns null when the country code isn't worth recording (unknown/garbage).
export function bumpGeo(raw: string | null, country: string | undefined): GeoData | null {
  if (!country || !/^[A-Z]{2}$/.test(country) || country === 'XX' || country === 'T1') return null
  const data = parseGeo(raw)
  data.countries[country] = (data.countries[country] ?? 0) + 1
  return data
}

// Merge a batch of pending per-country counts into the stored snapshot.
// Returns null when nothing in the batch was valid.
export function mergeGeo(raw: string | null, batch: Record<string, number>): GeoData | null {
  const data = parseGeo(raw)
  let changed = false
  for (const [country, count] of Object.entries(batch)) {
    if (!/^[A-Z]{2}$/.test(country) || country === 'XX' || country === 'T1') continue
    if (!Number.isFinite(count) || count <= 0) continue
    data.countries[country] = (data.countries[country] ?? 0) + Math.floor(count)
    changed = true
  }
  return changed ? data : null
}

// Crawlers, previews and our own tooling shouldn't count as visitors.
const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|monitor|curl|wget|python|headless|lighthouse|smoke-test/i

export function looksLikeBot(userAgent: string | null): boolean {
  if (!userAgent) return true
  return BOT_RE.test(userAgent)
}

// A real browser opening a page sends Sec-Fetch-Mode: navigate; scanners
// that fake a Chrome User-Agent almost never bother. New domains get
// hammered by CT-log scanners, and without this gate every hit cost a KV
// write (the free tier allows 1000/day).
export function isHumanNavigation(headers: Headers): boolean {
  if (looksLikeBot(headers.get('user-agent'))) return false
  return headers.get('sec-fetch-mode') === 'navigate'
}
