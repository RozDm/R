// Client-side helpers for the visitor-country data (/api/geo).

// Colour intensity for a country on the world map (1/2/3, null = no visits),
// relative to the busiest country on a log scale. The CSS owns the actual
// colours (.geo-map path[data-v]); this only picks the bucket. Fixed cut-offs
// (<3 / <10 / ≥10) used to put every country past ten visits into the same
// top shade, so growing traffic flattened the map into one colour — relative
// buckets keep three readable shades at any volume.
export type GeoBucket = '1' | '2' | '3'

export function geoBucket(count: number | undefined, max: number): GeoBucket | null {
  if (!count || count <= 0 || max <= 0) return null
  const r = Math.log1p(count) / Math.log1p(Math.max(count, max))
  if (r > 2 / 3) return '3'
  if (r > 1 / 3) return '2'
  return '1'
}

// One /api/geo request per page view, shared by the map and the Trends "Alt"
// total (they used to fetch it twice). Re-fetched after the endpoint's own
// 60 s edge-cache TTL so a client-side navigation back to / isn't stuck on an
// old number; a failed request is forgotten so the next caller retries.
const TTL_MS = 60_000
let cached: { at: number; promise: Promise<Record<string, number>> } | null = null

export function fetchGeoCountries(): Promise<Record<string, number>> {
  const now = Date.now()
  if (cached && now - cached.at < TTL_MS) return cached.promise
  const promise = fetch('/api/geo', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
    .then((d: { countries?: Record<string, number> }) => d.countries ?? {})
  promise.catch(() => {
    if (cached?.promise === promise) cached = null
  })
  cached = { at: now, promise }
  return promise
}
