// Visitor-country counters in D1. recordGeo() upserts on human navigations
// (called from the HTML path), GET /api/geo reads the aggregate.
import { apiJson, cachedApiJson, putCachedApiJson } from '../http'
import { countriesFromRows, isCountableCountry } from '../metrics'

// Aggregate moves slowly (counts tick up by 1 per visit) and the world map
// asks for it once per page load — cache the rolled-up read at the edge so
// most page loads cost zero D1 reads. 5 min is short enough that a new
// country shows up promptly and long enough to absorb traffic bursts.
const GEO_CACHE_TTL_S = 300

// Atomic upsert — no client-side batching or read-modify-write races, and the
// D1 free tier allows 100k writes/day vs KV's 1000.
export function recordGeo(env: Env, ctx: ExecutionContext, country: string | undefined): void {
  if (!isCountableCountry(country)) return
  ctx.waitUntil(
    env.METRICS.prepare(
      'INSERT INTO geo (country, count) VALUES (?1, 1) ON CONFLICT(country) DO UPDATE SET count = count + 1',
    )
      .bind(country)
      .run()
      .catch(() => {}),
  )
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
