// Visitor-country counters in D1. recordGeo() upserts on human navigations
// (called from the HTML path), GET /api/geo reads the aggregate.
import { apiJson } from '../http'
import { countriesFromRows, isCountableCountry } from '../metrics'

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

export async function handleGeo(url: URL, env: Env): Promise<Response | null> {
  if (url.pathname !== '/api/geo') return null
  const rows = await env.METRICS.prepare('SELECT country, count FROM geo')
    .all<{ country: string; count: number }>()
    .catch(() => null)
  return apiJson(JSON.stringify({ countries: countriesFromRows(rows?.results ?? []) }))
}
