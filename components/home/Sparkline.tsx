'use client'

import { useEffect, useState } from 'react'

interface Point {
  ts: string
  value: number
}

interface Series {
  metric: string
  range: string
  points: Point[]
}

// Inline SVG sparkline — no chart library, no vendor JS, no extra CSP origin.
// Draws a polyline through normalised points across the viewBox. Empty / one-
// point series render a flat line, so the UI never collapses.
function pathFor(points: Point[], width: number, height: number): string {
  if (points.length === 0) return ''
  const max = Math.max(1, ...points.map((p) => p.value))
  const step = points.length > 1 ? width / (points.length - 1) : 0
  return points
    .map((p, i) => {
      const x = points.length === 1 ? width / 2 : i * step
      const y = height - (p.value / max) * height
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

const W = 600
const H = 60

export default function Sparkline({ metric, range, label }: { metric: 'view' | 'geo'; range: '24h' | '7d' | '30d'; label: string }) {
  const [series, setSeries] = useState<Series | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/timeseries?metric=${metric}&range=${range}`, { signal: controller.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
      .then((d: Series) => setSeries(d))
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setFailed(true)
      })
    return () => controller.abort()
  }, [metric, range])

  if (failed) return null
  const points = series?.points ?? []
  const total = points.reduce((sum, p) => sum + p.value, 0)
  const path = pathFor(points, W, H)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between text-xs font-mono text-gray-500 dark:text-gray-400">
        <span>{label}</span>
        <span className="text-gray-400 dark:text-gray-500">
          {total} siste {range === '24h' ? '24 t' : range === '7d' ? '7 dager' : '30 dager'}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-16"
        role="img"
        aria-label={`${label} – tidsserie`}
        preserveAspectRatio="none"
      >
        {points.length === 0 ? (
          <line x1="0" y1={H - 1} x2={W} y2={H - 1} className="stroke-gray-300 dark:stroke-gray-700" strokeWidth="1" />
        ) : (
          <path d={path} fill="none" className="stroke-red-500/80" strokeWidth="1.5" />
        )}
      </svg>
    </div>
  )
}
