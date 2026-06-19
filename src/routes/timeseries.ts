// GET /api/timeseries?metric=view|geo&range=24h|7d|30d
//
// Queries the Cloudflare Analytics Engine SQL API and returns a bucketed
// [{ts, value}] series for the front-end sparkline. When the account id or
// API token aren't set (deploy without the secrets), we fall back to an empty
// series so the UI degrades gracefully instead of erroring.
import { apiJson, cachedApiJson, putCachedApiJson } from '../http'
import {
  buildSeriesSql,
  parseMetric,
  parseRange,
  parseSeriesResponse,
} from '../timeseries'

const DATASET = 'rozsoshnykh_metrics'

export async function handleTimeseries(
  url: URL,
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response | null> {
  if (url.pathname !== '/api/timeseries') return null

  const metric = parseMetric(url.searchParams.get('metric'))
  if (!metric) return apiJson('{"error":"bad metric"}', 400)
  const { key: rangeKey, range } = parseRange(url.searchParams.get('range'))

  // URL-based cache key is enough — the response only depends on metric+range.
  const cache = await cachedApiJson(request)
  if (cache.hit) return cache.hit

  let points: { ts: string; value: number }[] = []
  if (env.CF_ACCOUNT_ID && env.AE_API_TOKEN) {
    try {
      const sql = buildSeriesSql(DATASET, metric, range)
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.AE_API_TOKEN}`,
            'Content-Type': 'text/plain',
          },
          body: sql,
        },
      )
      if (res.ok) {
        const payload: unknown = await res.json()
        points = parseSeriesResponse(payload)
      }
    } catch {
      // Network/JSON failure — degrade to an empty series. Better an empty
      // sparkline than a 500 on a vanity endpoint.
    }
  }

  const body = JSON.stringify({ metric, range: rangeKey, points })
  return putCachedApiJson(ctx, cache.key, body, range.ttlSeconds)
}
