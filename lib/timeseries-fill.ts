// Zero-fill a sparse AE time-series into a dense, gap-free bucket list so the
// front-end wave chart shows real lulls as zero instead of interpolating a
// straight line across empty hours. Pure + deterministic (pass `now` in
// tests). DOM-compatible only — imported under the app tsconfig.
//
// AE returns one row per bucket that actually had events (GROUP BY ts), with
// the bucket start as a UTC string like "2026-06-19 18:00:00". We regenerate
// the full set of bucket keys for the window and merge by exact string key —
// no Date parsing, so the local-vs-UTC ambiguity never bites the merge. The
// incoming keys are run through normalizeBucketKey first so an AE-side format
// drift (ISO 'T', trailing 'Z', fractional seconds) can't silently miss every
// key and blank the chart — the merge, not just the endpoint, is defended.

import { normalizeBucketKey } from '@/src/timeseries'

export interface SeriesPoint {
  ts: string
  value: number
}

// step = bucket size, count = how many buckets to draw. count is window/step
// + 1 so the oldest partial bucket AE might return is still covered.
const RANGE_BUCKETS: Record<string, { stepMs: number; count: number }> = {
  '24h': { stepMs: 3_600_000, count: 25 },
  '7d': { stepMs: 3_600_000, count: 169 },
  '30d': { stepMs: 6 * 3_600_000, count: 121 },
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// "YYYY-MM-DD HH:MM:SS" in UTC — matches AE's toStartOfHour /
// toStartOfInterval output exactly.
function utcBucketKey(ms: number): string {
  const d = new Date(ms)
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  )
}

export function fillBuckets(
  points: SeriesPoint[],
  range: string,
  now: number = Date.now(),
): SeriesPoint[] {
  const cfg = RANGE_BUCKETS[range] ?? RANGE_BUCKETS['7d']
  const byKey = new Map(points.map((p) => [normalizeBucketKey(p.ts), p.value]))
  // Align the right edge to a bucket boundary (also where AE's buckets land,
  // since both 1h and 6h divide evenly from the epoch).
  const end = Math.floor(now / cfg.stepMs) * cfg.stepMs
  const out: SeriesPoint[] = []
  for (let i = cfg.count - 1; i >= 0; i--) {
    const key = utcBucketKey(end - i * cfg.stepMs)
    out.push({ ts: key, value: byKey.get(key) ?? 0 })
  }
  return out
}
