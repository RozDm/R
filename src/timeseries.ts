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
// UTC timestamp ('YYYY-MM-DD HH:MM:SS') — when set, AE silently ignores
// anything older. Empty/absent → no floor, behaves as before.
export const METRICS_EPOCH = '2026-06-20 17:15:00'

// Build the AE SQL query. Identifiers are fixed strings (dataset, blob index,
// bucket function from RANGES) — no user input is interpolated. The optional
// epoch floor lets us cut off pre-relaunch noise that AE can't delete.
export function buildSeriesSql(
  dataset: string,
  metric: SeriesMetric,
  range: SeriesRange,
  epoch: string = METRICS_EPOCH,
): string {
  const where = [
    `blob1 = '${metric}'`,
    `timestamp > NOW() - ${range.intervalSql}`,
    ...(epoch ? [`timestamp >= toDateTime('${epoch}')`] : []),
  ].join(' AND ')
  return [
    `SELECT ${range.bucketSql} AS ts, SUM(_sample_interval) AS value`,
    `FROM ${dataset}`,
    `WHERE ${where}`,
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
export function parseSeriesResponse(payload: unknown): SeriesPoint[] {
  if (typeof payload !== 'object' || payload === null) return []
  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) return []
  const points: SeriesPoint[] = []
  for (const row of data) {
    if (typeof row !== 'object' || row === null) continue
    const { ts, value } = row as { ts?: unknown; value?: unknown }
    if (typeof ts !== 'string') continue
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(n) || n < 0) continue
    points.push({ ts, value: n })
  }
  return points
}
