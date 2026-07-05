// GET /api/status — serve the latest uptime snapshot from KV.
//
// The dashboard polls every 30–90 s and the footer dot fires once per page,
// so this gets hit on nearly every visit. The KV snapshot only changes when
// the cron runs (every 5 min), so cache the read at the edge for 60 s — well
// under the cron interval, easily under the dashboard's OK refresh, and the
// KV read cost drops to roughly one per minute per colo instead of one per
// page view.
import { apiJson, cachedApiJson, putCachedApiJson } from '../http'
import { STATUS_KEY } from '../status'

const STATUS_CACHE_TTL_S = 60

export async function handleStatus(
  url: URL,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response | null> {
  if (url.pathname !== '/api/status') return null
  // Canonical key: path only — no parameters, so junk query strings must not
  // fragment (and thereby bypass) the cache.
  const cache = await cachedApiJson(`${url.origin}${url.pathname}`)
  if (cache.hit) return cache.hit

  let body = '{"results":[],"history":[]}'
  try {
    body = (await env.STATUS.get(STATUS_KEY)) || body
  } catch {}
  // Only cache positive snapshots; an empty body comes from a KV error and
  // shouldn't pin the bad state at the edge for a minute.
  if (body !== '{"results":[],"history":[]}') {
    return putCachedApiJson(ctx, cache.key, body, STATUS_CACHE_TTL_S)
  }
  return apiJson(body)
}
