// POST /api/visit — the single "Besøk" beacon. Fired once per browser
// session by the client (sessionStorage-deduped), so a visit counts once no
// matter how many pages the visitor clicks through. The Worker reads
// request.cf.country here and records it via recordGeo — D1 `geo` (the
// "Hvor leserne kommer fra" map) and an AE point (the "Besøk" time-series)
// come from this one call, so the map and the chart are two views of the
// same dataset.
//
// GET is a harmless self-diagnostic (shows the caller's own country and
// whether it would count; stores nothing) — handy when the map looks empty,
// e.g. to tell "ad-blocker swallowed the POST" from "edge sees no country".
import { apiJson } from '../http'
import { isWriteAllowed, isCountableCountry } from '../metrics'
import { recordGeo } from './geo'

export function handleVisit(
  url: URL,
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Response | null {
  if (url.pathname !== '/api/visit') return null

  if (request.method === 'GET') {
    const c = request.cf?.country
    return apiJson(
      JSON.stringify({
        country: typeof c === 'string' ? c : null,
        countable: typeof c === 'string' && isCountableCountry(c),
        note: 'A real visit is recorded by the POST beacon from the page, not this GET.',
      }),
    )
  }

  if (request.method !== 'POST') return null

  if (!isWriteAllowed(request.headers)) {
    return apiJson('{"error":"forbidden"}', 403)
  }

  // Visible in Worker observability logs — confirms the beacon reached the
  // edge and what country it carried, so an empty map is diagnosable.
  console.log('visit', request.cf?.country)
  recordGeo(env, ctx, request.cf?.country)
  return apiJson('{"ok":true}')
}
