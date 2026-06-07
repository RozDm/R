'use client'

import { useEffect, useState } from 'react'

interface ServiceResult {
  name: string
  url: string
  ok: boolean
  status: number
  ms: number
}

interface StatusData {
  updatedAt?: string
  results: ServiceResult[]
  history?: { at: string; up: boolean }[]
}

function formatTime(iso?: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('nb-NO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

export default function StatusDashboard() {
  const [data, setData] = useState<StatusData | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((d: StatusData) => {
        setData(d)
        setState('ok')
      })
      .catch(() => setState('error'))
  }, [])

  if (state === 'loading') {
    return <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">Laster status…</p>
  }
  if (state === 'error' || !data) {
    return <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">Kunne ikke hente status.</p>
  }

  const results = data.results || []
  const allUp = results.length > 0 && results.every((r) => r.ok)
  const noData = results.length === 0

  return (
    <div className="flex flex-col gap-8">
      {/* Overall banner */}
      <div
        className={`flex items-center gap-3 rounded-xl border p-5 ${
          noData
            ? 'border-gray-200 dark:border-gray-800'
            : allUp
              ? 'border-green-500/30 bg-green-500/5'
              : 'border-red-500/30 bg-red-500/5'
        }`}
      >
        <span
          className={`inline-block w-3 h-3 rounded-full ${
            noData ? 'bg-gray-400' : allUp ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="font-medium text-gray-900 dark:text-white">
          {noData ? 'Ingen data ennå' : allUp ? 'Alle systemer operative' : 'Driftsforstyrrelser'}
        </span>
        <span className="ml-auto text-xs font-mono text-gray-400 dark:text-gray-500">
          Oppdatert: {formatTime(data.updatedAt)}
        </span>
      </div>

      {/* Per-service rows */}
      <div className="flex flex-col gap-3">
        {results.map((r) => (
          <div
            key={r.name}
            className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50"
          >
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${r.ok ? 'bg-green-500' : 'bg-red-500'}`} />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900 dark:text-white">{r.name}</span>
              <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{r.url}</span>
            </div>
            <div className="ml-auto text-right">
              <div className={`text-sm font-mono ${r.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {r.ok ? 'Operativ' : 'Nede'}
              </div>
              <div className="text-xs font-mono text-gray-400 dark:text-gray-500">
                {r.status || '—'} · {r.ms} ms
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Uptime bar from history */}
      {data.history && data.history.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
            Historikk (siste {data.history.length} sjekker)
          </span>
          <div className="flex gap-[3px]">
            {data.history.map((h, i) => (
              <span
                key={i}
                title={`${formatTime(h.at)} — ${h.up ? 'oppe' : 'nede'}`}
                className={`h-8 flex-1 rounded-sm ${h.up ? 'bg-green-500/70' : 'bg-red-500/70'}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
