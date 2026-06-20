'use client'

import { useEffect, useMemo, useState } from 'react'
import { xTicksFor } from '@/lib/trends-axis'

interface Point {
  ts: string
  value: number
}

interface Series {
  metric: string
  range: string
  points: Point[]
}

type Metric = 'geo' | 'view'
type Range = '24h' | '7d' | '30d'

const METRICS: { id: Metric; label: string }[] = [
  { id: 'geo', label: 'Besøk' },
  { id: 'view', label: 'Sidevisninger' },
]
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

export default function Trends() {
  const [metric, setMetric] = useState<Metric>('geo')
  const [range, setRange] = useState<Range>('7d')
  const [series, setSeries] = useState<Series | null>(null)
  const [failed, setFailed] = useState(false)

  // Derived loading state: true while the current series doesn't match the
  // selected metric/range yet. Avoids setLoading(true) inside the effect
  // body (react-hooks/set-state-in-effect) by letting the data answer it.
  const loading = !failed && (!series || series.metric !== metric || series.range !== range)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/timeseries?metric=${metric}&range=${range}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
      .then((d: Series) => setSeries(d))
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setFailed(true)
      })
    return () => controller.abort()
  }, [metric, range])

  const { bars, yMax, total, tickLabels } = useMemo(() => {
    const points = series?.points ?? []
    const max = niceCeil(Math.max(1, ...points.map((p) => p.value)))
    const n = points.length
    // Bucketed counts are a histogram, not a continuous signal — draw bars,
    // one per returned bucket. A flat line across sparse points implied a
    // constant value and interpolated across empty hours; two visits in two
    // different hours now read as two separate bars summing to the total.
    const slotW = n > 0 ? PLOT_W / n : PLOT_W
    const barW = Math.min(slotW * 0.7, 48)
    const baseline = PAD_T + PLOT_H
    const computed = points.map((p, i) => {
      const cx = PAD_L + (i + 0.5) * slotW
      // Floor a non-zero count to 2px so a single view is never invisible
      // against a tall y-axis.
      const h = Math.max((p.value / max) * PLOT_H, p.value > 0 ? 2 : 0)
      return { cx, x: cx - barW / 2, w: barW, h, y: baseline - h, ts: p.ts }
    })
    const ticks = xTicksFor(computed, (b) => b.cx, (b) => formatTick(b.ts, range))
    return {
      bars: computed,
      yMax: max,
      total: points.reduce((sum, p) => sum + p.value, 0),
      tickLabels: ticks,
    }
  }, [series, range])

  if (failed) return null

  const points = series?.points ?? []
  const isEmpty = !loading && points.length === 0
  // Integer, de-duplicated y-ticks: a max of 1 would otherwise label 0/0.5/1
  // as "0,1,1" after rounding. Collapsing to unique ints keeps it honest.
  const yTicks = Array.from(new Set([0, Math.round(yMax / 2), yMax]))
  const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? ''
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
          Sampled tidsserie fra Workers Analytics Engine. Hver
          sidenavigasjon (Besøk) og hver postvisning (Sidevisninger) er ett
          datapunkt. Ingen informasjonskapsler.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-5 md:p-6 flex flex-col gap-5 hover:border-red-500/30 transition-colors duration-300 ease-out">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Metrikk" className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden text-xs font-mono">
            {METRICS.map((m) => (
              <button
                key={m.id}
                role="tab"
                aria-selected={metric === m.id}
                onClick={() => setMetric(m.id)}
                className={`px-3 py-1.5 transition-colors duration-200 ease-out ${metric === m.id ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
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

        <div className="flex items-baseline justify-between text-xs font-mono text-gray-500 dark:text-gray-400">
          <span>
            {metricLabel}, siste {rangeLabel}
          </span>
          <span className={`tabular-nums ${loading ? 'opacity-50' : ''}`}>
            <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{total}</span>{' '}
            <span>totalt</span>
          </span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={`w-full h-56 transition-opacity duration-300 ease-out ${loading ? 'opacity-50' : ''}`}
          role="img"
          aria-label={`${metricLabel} – tidsserie, siste ${rangeLabel}`}
          preserveAspectRatio="none"
        >
          {/* Y-axis ticks (0, mid, max) and faint gridlines. */}
          {yTicks.map((v, i) => {
            const y = PAD_T + PLOT_H - (v / yMax) * PLOT_H
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

          {/* One bar per bucket. rx rounds the top slightly; capped at half
              the bar width so thin 7d/30d bars don't turn into lozenges. */}
          {bars.map((b, i) => (
            <rect
              key={i}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={Math.min(2, b.w / 2)}
              className="fill-red-500"
            />
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
