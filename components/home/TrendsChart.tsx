'use client'

import { useEffect, useMemo, useState } from 'react'
import { xTicksFor } from '@/lib/trends-axis'
import { fillBuckets } from '@/lib/timeseries-fill'

interface Point {
  ts: string
  value: number
}

interface Series {
  metric: string
  range: string
  points: Point[]
}

type Range = '24h' | '7d' | '30d' | 'all'

const RANGES: { id: Range; label: string }[] = [
  { id: '24h', label: '24t' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'Alt' },
]

const W = 800
const H = 220
const PAD_L = 40
const PAD_R = 12
const PAD_T = 12
const PAD_B = 28
const PLOT_W = W - PAD_L - PAD_R
const PLOT_H = H - PAD_T - PAD_B
const BASELINE = PAD_T + PLOT_H

// Round up to a "nice" number for the y-axis ceiling (1/2/5 * 10^n). Keeps
// tick labels readable instead of "max=37, axis goes to 37".
function niceCeil(n: number): number {
  if (n <= 1) return 1
  const exp = Math.floor(Math.log10(n))
  const base = Math.pow(10, exp)
  const norm = n / base
  if (norm <= 1) return base
  if (norm <= 2) return 2 * base
  if (norm <= 5) return 5 * base
  return 10 * base
}

const dateFmt24 = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit' })
const dateFmtDay = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short' })

// AE bucket keys are "YYYY-MM-DD HH:MM:SS" in UTC. V8 parses that space form
// as LOCAL time, which made the axis read in the visitor's timezone shifted
// by the offset (e.g. "18:00" for a 20:00-Oslo event). Normalise to ISO-Z so
// Intl.DateTimeFormat then renders it correctly in the visitor's locale.
function formatTick(ts: string, range: Range): string {
  const iso = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return range === '24h' ? dateFmt24.format(d) : dateFmtDay.format(d)
}

interface Dot {
  x: number
  y: number
  ts: string
  value: number
}

export default function TrendsChart() {
  const [range, setRange] = useState<Range>('7d')
  const [series, setSeries] = useState<Series | null>(null)
  const [failed, setFailed] = useState(false)
  // Exact all-time total, straight from D1 via /api/geo — the same source and
  // number as the map above. Shown as the headline ONLY on the `Alt` (all
  // time) tab, where it must match the map exactly rather than inherit AE's
  // sampling. The windowed tabs show their own AE count (see displayTotal).
  // Doesn't depend on `range`.
  const [geoTotal, setGeoTotal] = useState<number | null>(null)
  // The chart only renders client-side (dynamic import with ssr:false), so
  // there's no SSR-vs-hydration mismatch concern left and we can render the
  // real data immediately on mount.

  const loading = !failed && (!series || series.range !== range)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/timeseries?metric=geo&range=${range}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
      .then((d: Series) => {
        setSeries(d)
        setFailed(false)
      })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setFailed(true)
      })
    return () => controller.abort()
  }, [range])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/geo', { signal: controller.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
      .then((d: { countries?: Record<string, number> }) => {
        const sum = Object.values(d.countries ?? {}).reduce((a, b) => a + b, 0)
        setGeoTotal(sum)
      })
      // Leave geoTotal null on failure so the headline shows '–', not a
      // misleading 0 — the map handles its own empty-state separately.
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const { dots, yMax, waveTotal, tickLabels } = useMemo(() => {
    // Zero-fill so the x-axis spans the whole window and quiet stretches read
    // as real gaps. We plot a point per bucket that actually had visits; empty
    // buckets contribute no dot (just a gap).
    const filled = fillBuckets(series?.points ?? [], range)
    const max = niceCeil(Math.max(1, ...filled.map((p) => p.value)))
    const n = filled.length
    const coords: Dot[] = filled.map((p, i) => ({
      x: n === 1 ? PAD_L + PLOT_W / 2 : PAD_L + (i / (n - 1)) * PLOT_W,
      y: BASELINE - (p.value / max) * PLOT_H,
      ts: p.ts,
      value: p.value,
    }))
    return {
      dots: coords.filter((c) => c.value > 0),
      yMax: max,
      // AE's (sampled) sum over the visible window. It's the headline count on
      // the windowed tabs (24t/7d/30d — "visits in this period") and, on the
      // `Alt` tab, only the empty-window vs. empty-dataset signal — there the
      // headline switches to the exact D1 total.
      waveTotal: filled.reduce((sum, p) => sum + p.value, 0),
      // X ticks come from the full grid so labels span the window even though
      // only non-empty buckets get a dot.
      tickLabels: xTicksFor(coords, (c) => c.x, (c) => formatTick(c.ts, range)),
    }
  }, [series, range])

  // Don't unmount the whole section on a fetch hiccup — that nuked the header
  // and the period tabs, leaving no way to retry without a page reload.
  // Degrade inside the chart instead; switching range re-runs the fetch.
  const isEmpty = !loading && !failed && waveTotal === 0
  // A quiet window (visits exist, just none in this range) reads differently
  // from a genuinely empty dataset — say which so a non-zero total below
  // doesn't sit next to a bare "Ingen data ennå".
  const emptyMsg = geoTotal && geoTotal > 0 ? 'Ingen besøk i denne perioden' : 'Ingen data ennå'
  // Integer, de-duplicated y-ticks so a max of 1 doesn't label 0/0.5/1 as
  // "0,1,1" after rounding.
  const yTicks = Array.from(new Set([0, Math.round(yMax / 2), yMax]))
  const rangeLabel = RANGES.find((r) => r.id === range)?.label ?? ''
  // Headline number: exact D1 all-time (= the map) on `Alt`, else the AE count
  // for the selected window. Label follows suit: "totalt" only when it truly is
  // the grand total, "siste 7d" etc. for a windowed count.
  const isAll = range === 'all'
  const displayTotal = isAll ? geoTotal : series ? waveTotal : null
  const totalLabel = isAll ? 'totalt' : `siste ${rangeLabel}`

  return (
    <div className="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-5 md:p-6 flex flex-col gap-5 hover:border-red-500/30 transition-colors duration-300 ease-out">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
          Besøk over tid
        </span>
        <div role="tablist" aria-label="Periode" className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden text-xs font-mono">
          {RANGES.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={range === r.id}
              onClick={() => setRange(r.id)}
              className={`px-3 py-1.5 transition-colors duration-200 ease-out ${range === r.id ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline justify-end text-xs font-mono text-gray-500 dark:text-gray-400">
        <span className={`tabular-nums ${loading ? 'opacity-50' : ''}`}>
          {/* On `Alt`: the exact D1 total (same number as the map). On the
              windowed tabs: the AE count for that window. '–' until the
              backing data lands — a dimmed "0" read as the data vanishing. */}
          <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{displayTotal !== null ? displayTotal : '–'}</span>{' '}
          <span>{totalLabel}</span>
        </span>
      </div>

      {/* h-auto (not a fixed height with preserveAspectRatio="none") so the
          viewBox scales uniformly and the dots stay round, not stretched. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={`w-full h-auto transition-opacity duration-300 ease-out ${loading ? 'opacity-50' : ''}`}
        role="img"
        aria-label={isAll ? 'Besøk per tidsrom, hele perioden' : `Besøk per tidsrom, siste ${rangeLabel}`}
      >
        {/* Y-axis ticks (0, mid, max) and faint gridlines. */}
        {yTicks.map((v, i) => {
          const y = BASELINE - (v / yMax) * PLOT_H
          return (
            <g key={i}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y}
                y2={y}
                className="stroke-gray-200 dark:stroke-gray-800"
                strokeWidth="1"
              />
              <text
                x={PAD_L - 6}
                y={y + 4}
                textAnchor="end"
                className="fill-gray-400 dark:fill-gray-500"
                fontSize="11"
                fontFamily="monospace"
              >
                {Math.round(v)}
              </text>
            </g>
          )
        })}

        {!isEmpty &&
          dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r="4" className="fill-red-500">
              <title>{`${d.value} besøk`}</title>
            </circle>
          ))}

        {tickLabels.map((t, i) => (
          <text
            key={i}
            x={t.x}
            y={H - 8}
            textAnchor={i === 0 ? 'start' : i === tickLabels.length - 1 ? 'end' : 'middle'}
            className="fill-gray-400 dark:fill-gray-500"
            fontSize="11"
            fontFamily="monospace"
          >
            {t.label}
          </text>
        ))}

        {(isEmpty || failed) && (
          <text
            x={W / 2}
            y={H / 2}
            textAnchor="middle"
            className="fill-gray-400 dark:fill-gray-500"
            fontSize="13"
            fontFamily="monospace"
          >
            {failed ? 'Kunne ikke laste — bytt periode for å prøve igjen' : emptyMsg}
          </text>
        )}
      </svg>
    </div>
  )
}
