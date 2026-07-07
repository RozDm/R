'use client'

import { useEffect, useMemo, useState } from 'react'
import { xTicksFor } from '@/lib/trends-axis'
import { fillBuckets } from '@/lib/timeseries-fill'
import { kdeSmooth, sigmaForBuckets } from '@/lib/trends-smooth'

interface Point {
  ts: string
  value: number
}

interface Series {
  metric: string
  range: string
  points: Point[]
}

type Range = '24h' | '7d' | '30d'

const RANGES: { id: Range; label: string }[] = [
  { id: '24h', label: '24t' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
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

// Smooth wave through the (dense, zero-filled) points using a Catmull-Rom
// spline emitted as one cubic Bézier per segment. Catmull-Rom passes through
// every point exactly (so isolated spikes still read at their true value —
// the earlier quadratic-through-midpoints version topped an isolated "1" out
// at ~0.75 and never touched the gridline) but with softer, S-shaped tangents
// than a monotone fit, so the wave reads as flowing rather than tight.
//
// The bucket grid is evenly spaced, so uniform Catmull-Rom is well-behaved (no
// loops). Its one hazard is overshoot — a valley handle can dip below 0 and
// smear the area fill under the baseline. We neutralise that by clamping each
// control handle's y into the plot band [PAD_T, BASELINE]: a cubic Bézier is
// contained in the convex hull of its four control points, and the two anchors
// are data points already in band, so a clamped-handle curve can never leave
// the band — no dips below 0, no spikes past the axis top.
//
// SMOOTH is the handle length as a fraction of the (p_{i+1} - p_{i-1}) span.
// 1/6 (≈0.167) is textbook Catmull-Rom; higher makes the S-curves fuller and
// more flowing. Keep it < 0.5 or the handles overshoot the segment in x and
// the curve folds back on itself.
const SMOOTH = 0.25

// Per-point handle taper. A smooth curve through an isolated max/min is forced
// horizontal there, and a long horizontal handle turns that crest into a flat
// plateau (visible as a straight line whenever a peak lands on the axis top,
// e.g. every "1" on the 24t range). tangentWeight shortens the handles at a
// point in proportion to how much it's a local extremum — near-1 on a
// monotonic slope (keep the flowing S-curve), down to ~0.3 at a symmetric
// peak/valley (tight, crisp crest) — so slopes stay smooth without plateauing
// the tops. Anchors are untouched, so the curve still passes through every
// point (peaks keep their true height).
function tangentWeight(pts: { x: number; y: number }[], i: number): number {
  const a = pts[i].y - (pts[i - 1] ?? pts[i]).y
  const b = (pts[i + 1] ?? pts[i]).y - pts[i].y
  const denom = Math.abs(a) + Math.abs(b)
  // |a+b|/(|a|+|b|): 1 when the two secants agree (monotonic), 0 when they
  // cancel (a symmetric extremum). Floor at 0.3 to keep crests rounded, not sharp.
  const r = denom < 1e-9 ? 1 : Math.abs(a + b) / denom
  return 0.3 + 0.7 * r
}

function wavePath(pts: { x: number; y: number }[]): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`

  const clampY = (y: number) => Math.max(PAD_T, Math.min(BASELINE, y))
  const w = pts.map((_, i) => tangentWeight(pts, i))
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    // Endpoints duplicate their neighbour (?? pts[i]) for a natural end tangent.
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? pts[i + 1]
    const s1 = SMOOTH * w[i]
    const s2 = SMOOTH * w[i + 1]
    const c1x = p1.x + (p2.x - p0.x) * s1
    const c1y = clampY(p1.y + (p2.y - p0.y) * s1)
    const c2x = p2.x - (p3.x - p1.x) * s2
    const c2y = clampY(p2.y - (p3.y - p1.y) * s2)
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

export default function TrendsChart() {
  const [range, setRange] = useState<Range>('7d')
  const [series, setSeries] = useState<Series | null>(null)
  const [failed, setFailed] = useState(false)
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

  const { areaPath, linePath, total, tickLabels } = useMemo(() => {
    // Zero-fill so empty hours read as real zeros, not a line interpolated
    // straight across a quiet night.
    const filled = fillBuckets(series?.points ?? [], range)
    // Smooth the sparse visits-per-bucket series into a traffic-density curve
    // (see lib/trends-smooth): a low-traffic window is mostly empty buckets, so
    // the raw line is a spike-forest. KDE turns each visit into a soft hill, so
    // the curve flows even for a single visitor. `total` stays the exact raw
    // sum — the density only shapes the line, it doesn't change the count.
    const density = kdeSmooth(filled.map((p) => p.value), sigmaForBuckets(filled.length))
    // Normalise to the window's own peak so the busiest period fills the card
    // regardless of absolute volume; the exact number lives in "totalt".
    const peak = Math.max(...density, 1e-9)
    const n = filled.length
    const coords = filled.map((p, i) => ({
      x: n === 1 ? PAD_L + PLOT_W / 2 : PAD_L + (i / (n - 1)) * PLOT_W,
      y: BASELINE - (density[i] / peak) * PLOT_H,
      ts: p.ts,
    }))
    const line = wavePath(coords)
    const area =
      coords.length > 0
        ? `${line} L${coords[coords.length - 1].x.toFixed(1)} ${BASELINE.toFixed(1)} L${coords[0].x.toFixed(1)} ${BASELINE.toFixed(1)} Z`
        : ''
    return {
      areaPath: area,
      linePath: line,
      total: filled.reduce((sum, p) => sum + p.value, 0),
      tickLabels: xTicksFor(coords, (c) => c.x, (c) => formatTick(c.ts, range)),
    }
  }, [series, range])

  // Don't unmount the whole section on a fetch hiccup — that nuked the header
  // and the period tabs, leaving no way to retry without a page reload.
  // Degrade inside the chart instead; switching range re-runs the fetch.
  const isEmpty = !loading && !failed && total === 0
  const rangeLabel = RANGES.find((r) => r.id === range)?.label ?? ''

  return (
    <div className="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-5 md:p-6 flex flex-col gap-5 hover:border-red-500/30 transition-colors duration-300 ease-out">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
          Besøk, siste {rangeLabel}
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
          {/* Before the first response lands there is no number to show —
              a dimmed "0 totalt" on every refresh read as the data vanishing. */}
          <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{series ? total : '–'}</span>{' '}
          <span>totalt</span>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={`w-full h-56 transition-opacity duration-300 ease-out ${loading ? 'opacity-50' : ''}`}
        role="img"
        aria-label={`Besøk – tidsserie, siste ${rangeLabel}`}
        preserveAspectRatio="none"
      >
        {/* Faint top + baseline gridlines to frame the plot. The curve is a
            normalised traffic-density trend, not a per-bucket count, so there
            are no numeric y-labels to read off — the exact figure is the
            "totalt" headline above. */}
        {[PAD_T, BASELINE].map((y, i) => (
          <line
            key={i}
            x1={PAD_L}
            x2={W - PAD_R}
            y1={y}
            y2={y}
            className="stroke-gray-200 dark:stroke-gray-800"
            strokeWidth="1"
          />
        ))}

        {!isEmpty && (
          <>
            <path d={areaPath} className="fill-red-500/10" />
            <path
              d={linePath}
              fill="none"
              className="stroke-red-500"
              strokeWidth="1.75"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}

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
            {failed ? 'Kunne ikke laste — bytt periode for å prøve igjen' : 'Ingen data ennå'}
          </text>
        )}
      </svg>
    </div>
  )
}
