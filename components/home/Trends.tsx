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

  const { linePath, areaPath, yMax, total, tickLabels, markers } = useMemo(() => {
    const points = series?.points ?? []
    const max = niceCeil(Math.max(1, ...points.map((p) => p.value)))
    const step = points.length > 1 ? PLOT_W / (points.length - 1) : 0
    const coords = points.map((p, i) => {
      const x = points.length === 1 ? PAD_L + PLOT_W / 2 : PAD_L + i * step
      const y = PAD_T + PLOT_H - (p.value / max) * PLOT_H
      return { x, y, ts: p.ts }
    })
    const line = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ')
    const area =
      coords.length > 0
        ? `${line} L${coords[coords.length - 1].x.toFixed(1)} ${(PAD_T + PLOT_H).toFixed(1)} L${coords[0].x.toFixed(1)} ${(PAD_T + PLOT_H).toFixed(1)} Z`
        : ''
    const ticks = xTicksFor(coords, (c) => c.x, (c) => formatTick(c.ts, range))
    return {
      linePath: line,
      areaPath: area,
      yMax: max,
      total: points.reduce((sum, p) => sum + p.value, 0),
      tickLabels: ticks,
      markers: coords,
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

          {points.length >= 2 && (
            <>
              <path d={areaPath} className="fill-red-500/10" />
              <path d={linePath} fill="none" className="stroke-red-500" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
            </>
          )}

          {/* A single bucket can't draw a line — mark it with a dot so the
              chart isn't blank when only one hour/interval has data. */}
          {points.length === 1 && markers[0] && (
            <circle cx={markers[0].x} cy={markers[0].y} r="4" className="fill-red-500" />
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
