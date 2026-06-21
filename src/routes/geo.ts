// Visitor-country counters in D1. recordGeo() upserts on human navigations
// (called from the HTML path), GET /api/geo reads the aggregate.
import { apiJson, cachedApiJson, putCachedApiJson } from '../http'
import { countriesFromRows, isCountableCountry } from '../metrics'

// Short TTL so a fresh visit shows up on the map within a minute. The
// underlying D1 query is cheap (single table aggregate) and traffic is
// low — no need to nurse this with a long cache. Bumping back up to 300s
// once traffic grows costs ~one config edit.
const GEO_CACHE_TTL_S = 60

// Atomic upsert — no client-side batching or read-modify-write races, and the
// D1 free tier allows 100k writes/day vs KV's 1000.
export function recordGeo(env: Env, ctx: ExecutionContext, country: unknown): void {
  if (typeof country !== 'string' || !isCountableCountry(country)) return
  ctx.waitUntil(
    env.METRICS.prepare(
      'INSERT INTO geo (country, count) VALUES (?1, 1) ON CONFLICT(country) DO UPDATE SET count = count + 1',
    )
      .bind(country)
      .run()
      .catch(() => {}),
  )
  // Time-series point so we can graph visits over time. D1 keeps the running
  // total per country; AE keeps the timestamped trail.
  try {
    env.METRICS_AE.writeDataPoint({ indexes: [country], blobs: ['geo', country], doubles: [1] })
  } catch {}
}

export async function handleGeo(
  url: URL,
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response | null> {
  if (url.pathname !== '/api/geo') return null
  const cache = await cachedApiJson(request)
  if (cache.hit) return cache.hit

  const rows = await env.METRICS.prepare('SELECT country, count FROM geo')
    .all<{ country: string; count: number }>()
    .catch(() => null)
  const body = JSON.stringify({ countries: countriesFromRows(rows?.results ?? []) })
  // Only cache on a successful query; a D1 hiccup shouldn't pin an empty map.
  if (rows) return putCachedApiJson(ctx, cache.key, body, GEO_CACHE_TTL_S)
  return apiJson(body)
}
