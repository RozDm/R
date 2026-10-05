// Visitor-country counters in D1. recordGeo() upserts once per browser
// session (called from the /api/visit beacon), GET /api/geo reads the aggregate.
import { apiJson, cachedApiJson, putCachedApiJson } from '../http'
import { countriesFromRows, isCountableCountry, isDatacenterAsn } from '../metrics'

// Short TTL so a fresh visit shows up on the map within a minute. The
// underlying D1 query is cheap (single table aggregate) and traffic is
// low — no need to nurse this with a long cache. Bumping back up to 300s
// once traffic grows costs ~one config edit.
const GEO_CACHE_TTL_S = 60

// Atomic upsert — no client-side batching or read-modify-write races, and the
// D1 free tier allows 100k writes/day vs KV's 1000.
//
// `network` (request.cf.asn / asOrganization) rides along on the AE point
// only — never in D1. A visit from a cloud/hosting network (isDatacenterAsn)
// isn't a reader: it skips D1 (the map and the Alt total) and lands in AE as
// blob1='bot' instead of 'geo', so analytics-report can show what the filter
// dropped. Network operator, not a person: no IP is stored.
export function recordGeo(
  env: Env,
  ctx: ExecutionContext,
  country: unknown,
  network: { asn?: unknown; org?: unknown } = {},
): void {
  if (typeof country !== 'string' || !isCountableCountry(country)) return
  const asn = typeof network.asn === 'number' ? `AS${network.asn}` : ''
  const org = typeof network.org === 'string' ? network.org.slice(0, 96) : ''
  if (isDatacenterAsn(network.asn)) {
    try {
      env.METRICS_AE.writeDataPoint({ indexes: [country], blobs: ['bot', country, asn, org], doubles: [1] })
    } catch {}
    return
  }
  ctx.waitUntil(
    env.METRICS.prepare(
      'INSERT INTO geo (country, count) VALUES (?1, 1) ON CONFLICT(country) DO UPDATE SET count = count + 1',
    )
      .bind(country)
      .run()
      // Logged, not thrown: the 2026-07 D1 outage failed these upserts
      // silently for days while AE kept counting (docs/history.md).
      .catch((err) => console.error('geo: D1 upsert failed', err)),
  )
  // Time-series point so we can graph visits over time. D1 keeps the running
  // total per country; AE keeps the timestamped trail.
  try {
    env.METRICS_AE.writeDataPoint({ indexes: [country], blobs: ['geo', country, asn, org], doubles: [1] })
  } catch {}
}

export async function handleGeo(
  url: URL,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response | null> {
  if (url.pathname !== '/api/geo') return null
  // Canonical key: path only — the response takes no parameters, so any query
  // string is noise that must not fragment (and thereby bypass) the cache.
  const cache = await cachedApiJson(`${url.origin}${url.pathname}`)
  if (cache.hit) return cache.hit

  const rows = await env.METRICS.prepare('SELECT country, count FROM geo')
    .all<{ country: string; count: number }>()
    .catch(() => null)
  const body = JSON.stringify({ countries: countriesFromRows(rows?.results ?? []) })
  // Only cache on a successful query; a D1 hiccup shouldn't pin an empty map.
  if (rows) return putCachedApiJson(ctx, cache.key, body, GEO_CACHE_TTL_S)
  return apiJson(body)
}
