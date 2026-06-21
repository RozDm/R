// Pure helpers for the AE-backed time-series endpoint. DOM-compatible APIs
// only — tests import this under the app tsconfig.

// Supported metrics: keep the surface small and explicit so a typo in the
// query string can't fan out into an arbitrary SQL clause.
export type SeriesMetric = 'view' | 'geo'

export function parseMetric(value: string | null): SeriesMetric | null {
  return value === 'view' || value === 'geo' ? value : null
}

// Range options aligned to common dashboard windows. Each maps to a SQL
// INTERVAL and a bucket size that keeps the resulting series under ~200 points
// — small enough to draw as an inline SVG sparkline.
export interface SeriesRange {
  intervalSql: string
  bucketSql: string
  ttlSeconds: number
}

const RANGES: Record<string, SeriesRange> = {
  '24h': { intervalSql: "INTERVAL '24' HOUR", bucketSql: 'toStartOfHour(timestamp)', ttlSeconds: 60 },
  '7d':  { intervalSql: "INTERVAL '7' DAY",   bucketSql: 'toStartOfHour(timestamp)', ttlSeconds: 300 },
  '30d': { intervalSql: "INTERVAL '30' DAY",  bucketSql: "toStartOfInterval(timestamp, INTERVAL '6' HOUR)", ttlSeconds: 600 },
}

export function parseRange(value: string | null): { key: string; range: SeriesRange } {
  const key = value && Object.hasOwn(RANGES, value) ? value : '7d'
  return { key, range: RANGES[key] }
}

// AE is append-only and can't be wiped, but old points (pre-relaunch,
// dev-noise, etc.) shouldn't show in the chart forever. METRICS_EPOCH is a
// UTC bucket-key string ('YYYY-MM-DD HH:MM:SS') — rows with `ts` lexically
// older than this are filtered out client-side (string compare works because
// the format is fixed-width and ISO-ordered). Empty string disables the
// floor. Filtering here, not in the AE SQL itself, sidesteps any
// SQL-dialect surprise (AE rejected toDateTime/CAST patterns we tried).
// REMINDER: bump this after every `reset-metrics` run.
export const METRICS_EPOCH = '2026-06-20 17:15:00'

// Build the AE SQL query. Identifiers are fixed strings (dataset, blob index,
// bucket function from RANGES) — no user input is interpolated. The epoch
// floor is intentionally NOT in the WHERE clause; it's applied by
// parseSeriesResponse so a SQL-side typo can't go silently empty.
export function buildSeriesSql(dataset: string, metric: SeriesMetric, range: SeriesRange): string {
  return [
    `SELECT ${range.bucketSql} AS ts, SUM(_sample_interval) AS value`,
    `FROM ${dataset}`,
    `WHERE blob1 = '${metric}' AND timestamp > NOW() - ${range.intervalSql}`,
    'GROUP BY ts',
    'ORDER BY ts ASC',
    'FORMAT JSON',
  ].join(' ')
}

export interface SeriesPoint {
  ts: string
  value: number
}

// Normalise an AE SQL API JSON response into [{ts, value}]. AE returns a
// `{ data: [...] }` envelope with row objects whose keys are the SELECT
// aliases. Drop anything that doesn't parse to a finite, non-negative number.
// `epoch` (UTC bucket key) drops rows older than that — used to hide
// pre-relaunch points that AE can't delete.
export function parseSeriesResponse(payload: unknown, epoch: string = METRICS_EPOCH): SeriesPoint[] {
  if (typeof payload !== 'object' || payload === null) return []
  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) return []
  const points: SeriesPoint[] = []
  for (const row of data) {
    if (typeof row !== 'object' || row === null) continue
    const { ts, value } = row as { ts?: unknown; value?: unknown }
    if (typeof ts !== 'string') continue
    if (epoch && ts < epoch) continue
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(n) || n < 0) continue
    points.push({ ts, value: n })
  }
  return points
}
