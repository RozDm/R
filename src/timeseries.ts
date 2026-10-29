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
// — small enough to draw as an inline SVG sparkline. `all` is the exception:
// its wave spans up to ~90 days (6h buckets → up to ~360 grid slots, but only
// non-empty buckets get a dot, so it stays cheap). The 90-day interval is a
// generous bound near AE's retention ceiling; `all`'s HEADLINE total comes
// from D1 (exact, forever), so the wave aging past retention never desyncs the
// number from the map. 6h buckets (not daily) keep `all` aligned to the
// 6-hour METRICS_EPOCH boundary — a daily bucket would straddle the 18:00
// epoch and drop the relaunch-day slot from the shape.
export interface SeriesRange {
  intervalSql: string
  bucketSql: string
  ttlSeconds: number
}

const RANGES: Record<string, SeriesRange> = {
  '24h': { intervalSql: "INTERVAL '24' HOUR", bucketSql: 'toStartOfHour(timestamp)', ttlSeconds: 60 },
  '7d':  { intervalSql: "INTERVAL '7' DAY",   bucketSql: 'toStartOfHour(timestamp)', ttlSeconds: 300 },
  '30d': { intervalSql: "INTERVAL '30' DAY",  bucketSql: "toStartOfInterval(timestamp, INTERVAL '6' HOUR)", ttlSeconds: 600 },
  'all': { intervalSql: "INTERVAL '90' DAY",  bucketSql: "toStartOfInterval(timestamp, INTERVAL '6' HOUR)", ttlSeconds: 900 },
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
//
// MUST sit on a 6-hour UTC boundary (00/06/12/18; tests/timeseries.test.ts):
// the filter compares bucket-START keys, so a mid-bucket epoch drops a
// straddling 6h bucket's real visits and the chart undercounts the map (why:
// docs/history.md). Bump it after every `reset-metrics` run, rounding UP to
// the next boundary so no pre-reset noise slips in. Now: the reset of
// 2026-10-22 21:30 UTC, rounded up.
export const METRICS_EPOCH = '2026-10-23 00:00:00'

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

// Canonicalise a bucket key to the fixed-width UTC form "YYYY-MM-DD HH:MM:SS"
// that both the epoch compare (below) and the client-side merge
// (lib/timeseries-fill.ts `utcBucketKey`) assume. AE currently emits exactly
// that, so today this is a no-op — but the whole pipeline hangs on a raw
// string equality, and an AE-side format drift (ISO 'T' separator, a trailing
// 'Z'/offset, fractional seconds) would silently zero-fill the whole chart
// while the D1-backed map kept working. Normalising here (and again at the
// merge) makes such a drift harmless instead of an invisible outage. A string
// that doesn't look like a datetime (defensive) is returned untouched.
export function normalizeBucketKey(ts: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(ts)
  return m ? `${m[1]} ${m[2]}` : ts
}

// Normalise an AE SQL API JSON response into [{ts, value}]. AE returns a
// `{ data: [...] }` envelope with row objects whose keys are the SELECT
// aliases. Drop anything that doesn't parse to a finite, non-negative number.
// `epoch` (UTC bucket key) drops rows older than that — used to hide
// pre-relaunch points that AE can't delete. `ts` is canonicalised first so the
// epoch compare and the downstream merge are immune to AE format drift.
export function parseSeriesResponse(payload: unknown, epoch: string = METRICS_EPOCH): SeriesPoint[] {
  if (typeof payload !== 'object' || payload === null) return []
  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) return []
  const points: SeriesPoint[] = []
  for (const row of data) {
    if (typeof row !== 'object' || row === null) continue
    const { ts, value } = row as { ts?: unknown; value?: unknown }
    if (typeof ts !== 'string') continue
    const key = normalizeBucketKey(ts)
    if (epoch && key < epoch) continue
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(n) || n < 0) continue
    points.push({ ts: key, value: n })
  }
  return points
}
