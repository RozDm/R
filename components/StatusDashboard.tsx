'use client'

import { useEffect, useState } from 'react'

interface ServiceResult {
  name: string
  url: string
  ok: boolean
  status: number
  ms: number
}

interface HistoryEntry {
  at: string
  up: Record<string, boolean>
}

interface StatusData {
  updatedAt?: string
  results: ServiceResult[]
  history?: HistoryEntry[]
}

const REFRESH_MS = 60_000 // cron runs every 5 min; 1 min keeps the view fresh enough

function formatTime(iso?: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('nb-NO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

export default function StatusDashboard() {
  const [data, setData] = useState<StatusData | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      try {
        const res = await fetch('/api/status', { signal: controller.signal, cache: 'no-store' })
        const d: StatusData = await res.json()
        setData(d)
        setState('ok')
      } catch {
        // Keep showing the last snapshot if a background refresh fails.
        if (!controller.signal.aborted) setState((prev) => (prev === 'ok' ? 'ok' : 'error'))
      }
    }

    load()
    const timer = setInterval(() => {
      if (!document.hidden) load()
    }, REFRESH_MS)
    const onVisibilityChange = () => {
      if (!document.hidden) load()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      controller.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  if (state === 'loading') {
    return <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">Åpner podbay-dørene…</p>
  }
  if (state === 'error' || !data) {
    return <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">Kunne ikke hente status.</p>
  }

  const results = data.results || []
  const history = data.history || []
  const allUp = results.length > 0 && results.every((r) => r.ok)
  const noData = results.length === 0
  const downCount = results.filter((r) => !r.ok).length

  return (
    <div className="flex flex-col gap-8">
      {/* Overall banner */}
      <div
        className={`flex items-center gap-3 rounded-xl border p-5 ${
          noData
            ? 'border-gray-200 dark:border-gray-800'
            : allUp
              ? 'border-green-500/30 bg-green-500/5'
              : 'border-red-500/40 bg-red-500/10'
        }`}
        role="status"
        aria-live="polite"
      >
        <span
          className={`inline-block w-3 h-3 rounded-full ${
            noData ? 'bg-gray-400' : allUp ? 'bg-green-500' : 'bg-red-500 animate-pulse'
          }`}
        />
        <span className="font-medium text-gray-900 dark:text-white">
          {noData
            ? 'Ingen data ennå'
            : allUp
              ? 'Alle systemer operative'
              : `Driftsforstyrrelser — ${downCount} av ${results.length} tjenester nede`}
        </span>
        <span className="ml-auto text-xs font-mono text-gray-500 dark:text-gray-400">
          Oppdatert: {formatTime(data.updatedAt)}
        </span>
      </div>

      {/* Per-service rows, each with its own uptime history bar */}
      <div className="flex flex-col gap-3">
        {results.map((r) => (
          <div
            key={r.name}
            className={`flex flex-col gap-3 p-4 rounded-xl border bg-white dark:bg-gray-900/50 transition-all duration-500 ${
              r.ok
                ? 'border-gray-200 dark:border-gray-800 hover:border-red-500/30 dark:hover:border-red-500/20'
                : 'border-red-500/40 bg-red-500/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${r.ok ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{r.name}</span>
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{r.url}</span>
              </div>
              <div className="ml-auto text-right">
                <div className={`text-sm font-mono ${r.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {r.ok ? 'Operativ' : 'Nede'}
                </div>
                <div className="text-xs font-mono text-gray-500 dark:text-gray-400">
                  {r.status || '—'} · {r.ms} ms
                </div>
              </div>
            </div>
            {history.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-[3px]">
                  {history.map((h, i) => {
                    const up = h.up?.[r.name]
                    return (
                      <span
                        key={i}
                        title={`${formatTime(h.at)} — ${up === undefined ? 'ingen data' : up ? 'oppe' : 'nede'}`}
                        className={`h-6 flex-1 rounded-sm ${
                          up === undefined ? 'bg-gray-300 dark:bg-gray-700' : up ? 'bg-green-500/70' : 'bg-red-500/70'
                        }`}
                      />
                    )
                  })}
                </div>
                <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                  Siste {history.length} sjekker
                  {history.length === 149 && (
                    <span title="Monolittens proporsjoner: 1² : 2² : 3²" className="text-gray-400 dark:text-gray-500">
                      {' '}· 1:4:9
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
