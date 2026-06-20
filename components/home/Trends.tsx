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

function formatTick(ts: string, range: Range): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return range === '24h' ? dateFmt24.format(d) : dateFmtDay.format(d)
}

// Smooth wave through the (dense, zero-filled) points using quadratic curves
// to each segment midpoint. A quadratic stays inside the triangle of its
// control points, so the curve never overshoots below 0 or above the peak —
// no fake negative dips from the smoothing.
function wavePath(pts: { x: number; y: number }[]): string {
  const n = pts.length
  if (n === 0) return ''
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  if (n === 1) return d
  for (let i = 0; i < n - 1; i++) {
    const xc = (pts[i].x + pts[i + 1].x) / 2
    const yc = (pts[i].y + pts[i + 1].y) / 2
    d += ` Q${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${xc.toFixed(1)} ${yc.toFixed(1)}`
  }
  d += ` L${pts[n - 1].x.toFixed(1)} ${pts[n - 1].y.toFixed(1)}`
  return d
}

export default function Trends() {
  const [range, setRange] = useState<Range>('7d')
  const [series, setSeries] = useState<Series | null>(null)
  const [failed, setFailed] = useState(false)

  // Derived loading state: true while the loaded series doesn't match the
  // selected range yet. Avoids setLoading(true) inside the effect body.
  const loading = !failed && (!series || series.range !== range)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/timeseries?metric=geo&range=${range}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
      .then((d: Series) => setSeries(d))
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setFailed(true)
      })
    return () => controller.abort()
  }, [range])

  const { areaPath, linePath, yMax, total, tickLabels } = useMemo(() => {
    // Zero-fill so empty hours read as real zeros, not a line interpolated
    // straight across a quiet night.
    const filled = fillBuckets(series?.points ?? [], range)
    const max = niceCeil(Math.max(1, ...filled.map((p) => p.value)))
    const n = filled.length
    const coords = filled.map((p, i) => ({
      x: n === 1 ? PAD_L + PLOT_W / 2 : PAD_L + (i / (n - 1)) * PLOT_W,
      y: BASELINE - (p.value / max) * PLOT_H,
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
      yMax: max,
      total: filled.reduce((sum, p) => sum + p.value, 0),
      tickLabels: xTicksFor(coords, (c) => c.x, (c) => formatTick(c.ts, range)),
    }
  }, [series, range])

  if (failed) return null

  const isEmpty = !loading && total === 0
  // Integer, de-duplicated y-ticks so a max of 1 doesn't label 0/0.5/1 as
  // "0,1,1" after rounding.
  const yTicks = Array.from(new Set([0, Math.round(yMax / 2), yMax]))
  const rangeLabel = RANGES.find((r) => r.id === range)?.label ?? ''

  return (
    <section id="trender" className="flex flex-col gap-8 animate-fade-in [animation-delay:750ms]">
      <div>
        <p className="text-red-500 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          Trender
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          Trafikk over tid
        </h2>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-xl">
          Sampled tidsserie fra Workers Analytics Engine. Ett besøk per økt
          (sesjon) — samme tall som kartet over, fordelt på tid. Ingen
          informasjonskapsler, ingen sporing.
        </p>
      </div>

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
            <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{total}</span>{' '}
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

          {isEmpty && (
            <text
              x={W / 2}
              y={H / 2}
              textAnchor="middle"
              className="fill-gray-400 dark:fill-gray-500"
              fontSize="13"
              fontFamily="monospace"
            >
              Ingen data ennå
            </text>
          )}
        </svg>
      </div>
    </section>
  )
}
