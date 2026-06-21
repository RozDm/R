// POST /api/visit — the single "Besøk" beacon. Fired once per browser
// session by the client (sessionStorage-deduped), so a visit counts once no
// matter how many pages the visitor clicks through. The Worker reads
// request.cf.country here and records it via recordGeo — D1 `geo` (the
// "Hvor leserne kommer fra" map) and an AE point (the "Besøk" time-series)
// come from this one call, so the map and the chart are two views of the
// same dataset.
//
// Replaces the old per-navigation edge counting, which inflated both numbers
// and couldn't dedupe without cookies. Same lightweight gate as the other
// write endpoints: same-origin + non-bot. (Bots rarely run the JS that fires
// the beacon, so the data skews human for free.)
import { apiJson } from '../http'
import { isWriteAllowed } from '../metrics'
import { recordGeo } from './geo'

export function handleVisit(
  url: URL,
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Response | null {
  if (url.pathname !== '/api/visit' || request.method !== 'POST') return null

  if (!isWriteAllowed(request.headers)) {
    return apiJson('{"error":"forbidden"}', 403)
  }

  recordGeo(env, ctx, request.cf?.country)
  return apiJson('{"ok":true}')
}
