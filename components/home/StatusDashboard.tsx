'use client'

import { useEffect, useState } from 'react'
import { HISTORY_LIMIT, isStale } from '@/src/status'

interface ServiceResult {
  name: string
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

// The cron writes every 5 min, so polling that often is plenty when all is
// well; during an incident, refresh sooner so the dashboard catches recovery
// (or further trouble) quickly.
const OK_REFRESH_MS = 90_000
const DOWN_REFRESH_MS = 30_000

function formatTime(iso?: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('nb-NO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

export default function StatusDashboard() {
  const [data, setData] = useState<StatusData | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  // Judged when each snapshot lands (and re-judged on every poll), not during
  // render — so a tab left open notices the checker going quiet.
  const [stale, setStale] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      if (document.hidden) {
        timer = setTimeout(tick, OK_REFRESH_MS)
        return
      }
      try {
        const res = await fetch('/api/status', { signal: controller.signal, cache: 'no-store' })
        const d: StatusData = await res.json()
        setData(d)
        setStale(!!d.updatedAt && isStale(d.updatedAt, Date.now()))
        setState('ok')
        const anyDown = (d.results || []).some((r) => !r.ok)
        timer = setTimeout(tick, anyDown ? DOWN_REFRESH_MS : OK_REFRESH_MS)
      } catch {
        // Keep showing the last snapshot if a background refresh fails.
        if (!controller.signal.aborted) {
          setState((prev) => (prev === 'ok' ? 'ok' : 'error'))
          timer = setTimeout(tick, OK_REFRESH_MS)
        }
      }
    }

    tick()
    const onVisibilityChange = () => {
      if (!document.hidden) {
        clearTimeout(timer)
        tick()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  // The placeholders reserve roughly the final height (banner + two service
  // cards). Without this, content below — like the #footer anchor target —
  // jumps once the data lands, which breaks hash navigation from other pages.
  if (state === 'loading') {
    return (
      <div className="min-h-[352px]">
        <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">Åpner podbay-dørene…</p>
      </div>
    )
  }
  if (state === 'error' || !data) {
    return (
      <div className="min-h-[352px]">
        <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">Kunne ikke hente status.</p>
      </div>
    )
  }

  const results = data.results || []
  const history = data.history || []
  const allUp = results.length > 0 && results.every((r) => r.ok)
  // A stale snapshot is reported as unknown (grey), never as green or red:
  // the last known state may no longer be true.
  const noData = results.length === 0
  const neutral = noData || stale
  const downCount = results.filter((r) => !r.ok).length

  return (
    <div className="flex flex-col gap-8 min-h-[352px]">
      {/* Overall banner */}
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border p-5 ${
          neutral
            ? 'border-gray-200 dark:border-gray-800'
            : allUp
              ? 'border-green-500/30 bg-green-500/5'
              : 'border-red-500/40 bg-red-500/10'
        }`}
        role="status"
        aria-live="polite"
      >
        <span
          className={`inline-block w-3 h-3 rounded-full shrink-0 ${
            neutral ? 'bg-gray-400' : allUp ? 'bg-green-500' : 'bg-red-500 animate-pulse'
          }`}
        />
        <span className="font-medium text-gray-900 dark:text-white">
          {noData
            ? 'Ingen data ennå'
            : stale
              ? 'Statusdata er utdatert — overvåkingen svarer ikke'
              : allUp
              ? 'Alle systemer operative'
              : `Driftsforstyrrelser — ${downCount} av ${results.length} tjenester nede`}
        </span>
        <span className="basis-full sm:basis-auto sm:ml-auto text-xs font-mono text-gray-600 dark:text-gray-400">
          Oppdatert: {formatTime(data.updatedAt)}
        </span>
      </div>

      {/* Per-service rows, each with its own uptime history bar */}
      <div className="flex flex-col gap-3">
        {results.map((r) => (
          <div
            key={r.name}
            className={`flex flex-col gap-3 p-4 rounded-xl border bg-white dark:bg-gray-900/50 transition-all duration-500 ${
              r.ok || stale
                ? 'border-gray-200 dark:border-gray-800 hover:border-red-500/30 dark:hover:border-red-500/20'
                : 'border-red-500/40 bg-red-500/5'
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${stale ? 'bg-gray-400' : r.ok ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
              <span className="text-sm font-medium text-gray-900 dark:text-white min-w-0">{r.name}</span>
              <div className="basis-full sm:basis-auto sm:ml-auto text-left sm:text-right">
                <div className={`text-sm font-mono ${stale ? 'text-gray-500 dark:text-gray-400' : r.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {stale ? `Sist kjent: ${r.ok ? 'operativ' : 'nede'}` : r.ok ? 'Operativ' : 'Nede'}
                </div>
                <div className="text-xs font-mono text-gray-500 dark:text-gray-400">
                  {r.status || '—'} · {r.ms} ms
                </div>
              </div>
            </div>
            {history.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-px sm:gap-[3px] min-w-0">
                  {history.map((h, i) => {
                    const up = h.up?.[r.name]
                    return (
                      <span
                        key={i}
                        title={`${formatTime(h.at)} — ${up === undefined ? 'ingen data' : up ? 'oppe' : 'nede'}`}
                        className={`h-6 flex-1 min-w-0 rounded-sm ${
                          up === undefined ? 'bg-gray-300 dark:bg-gray-700' : up ? 'bg-green-500/70' : 'bg-red-500/70'
                        }`}
                      />
                    )
                  })}
                </div>
                <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                  Siste {history.length} sjekker
                  {history.length === HISTORY_LIMIT && (
                    <span title="Monolittens proporsjoner: 1² : 2² : 3²" className="text-gray-500 dark:text-gray-400">
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
