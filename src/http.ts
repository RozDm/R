// Shared HTTP helper for the worker's JSON API responses.
import { ENFORCED_CSP, HSTS, applyBaseHeaders } from './csp'

export function apiJson(body: string, status = 200, cacheControl = 'no-store'): Response {
  const response = new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cacheControl },
  })
  applyBaseHeaders(response.headers)
  response.headers.set('Strict-Transport-Security', HSTS)
  response.headers.set('Content-Security-Policy', ENFORCED_CSP)
  return response
}

// Edge-cached read for JSON endpoints whose source-of-truth (KV/D1) changes
// slowly. The caller passes a canonical URL — built from the validated
// parameters only, never the raw request URL — so junk query params
// (`?x=1`, `?x=2`, …) collapse onto one cache entry instead of each
// bypassing the cache and hitting D1/AE directly. Public, vary-free, GET-only.
//
// Use it as:
//   const cache = await cachedApiJson(canonicalUrl)
//   if (cache.hit) return cache.hit
//   const body = ...build fresh body...
//   return putCachedApiJson(ctx, cache.key, body, TTL_SECONDS)
export async function cachedApiJson(
  canonicalUrl: string,
): Promise<{ hit: Response | null; key: Request }> {
  const key = new Request(canonicalUrl, { method: 'GET' })
  const hit = await caches.default.match(key)
  return { hit: hit ? withStoredTtl(hit) : null, key }
}

// On a cache HIT, Cloudflare's zone-level Browser Cache TTL (4 h by default)
// rewrites the stored max-age (60 → 14400) while leaving s-maxage alone.
// Restore the TTL we put in so browsers and shared caches don't hold a
// 60-second status snapshot for four hours. (If the zone rewrites again on
// egress, the dashboard fix is Browser Cache TTL → "Respect Existing
// Headers"; the front end is safe either way — it fetches with no-store.)
function withStoredTtl(hit: Response): Response {
  const ttl = /s-maxage=(\d+)/.exec(hit.headers.get('Cache-Control') ?? '')?.[1]
  if (!ttl) return hit
  const response = new Response(hit.body, hit)
  response.headers.set('Cache-Control', `public, max-age=${ttl}, s-maxage=${ttl}`)
  return response
}

export function putCachedApiJson(
  ctx: ExecutionContext,
  key: Request,
  body: string,
  seconds: number,
): Response {
  const response = apiJson(body, 200, `public, max-age=${seconds}, s-maxage=${seconds}`)
  // Clone before put: the body stream is single-use, and we still need to
  // return the original response to the client.
  ctx.waitUntil(caches.default.put(key, response.clone()))
  return response
}
