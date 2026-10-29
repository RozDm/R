'use client'

import { useEffect, useState } from 'react'
import { DICT } from '@/data/i18n'
import { INTL_LOCALE, type Lang } from '@/lib/i18n'
import { useLang } from '@/lib/use-lang'
import { HISTORY_LIMIT, isStale } from '@/src/status'
import { fetchStatus, type StatusSnapshot } from '@/lib/status-fetch'

// The cron writes every 5 min, so polling that often is plenty when all is
// well; during an incident, refresh sooner so the dashboard catches recovery
// (or further trouble) quickly.
const OK_REFRESH_MS = 90_000
const DOWN_REFRESH_MS = 30_000

function formatTime(lang: Lang, iso?: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(INTL_LOCALE[lang], { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

export default function StatusDashboard() {
  const lang = useLang()
  const t = DICT[lang].status
  const [data, setData] = useState<StatusSnapshot | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  // Judged when each snapshot lands (and re-judged on every poll), not during
  // render — so a tab left open notices the checker going quiet.
  const [stale, setStale] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    // Polls only while the section is on screen in a visible tab — each poll
    // is a Worker request, and nobody reads a dashboard scrolled out of view.
    // A refresh that falls due meanwhile runs as soon as it's back in view.
    let onScreen = true // until the observer's first report
    let due = false
    const watched = () => onScreen && !document.hidden

    const schedule = (ms: number) => {
      clearTimeout(timer)
      timer = setTimeout(() => (watched() ? tick() : (due = true)), ms)
    }

    const tick = async () => {
      due = false
      try {
        // The first call shares the footer dot's request (lib/status-fetch.ts).
        const d = await fetchStatus()
        if (cancelled) return
        setData(d)
        setStale(!!d.updatedAt && isStale(d.updatedAt, Date.now()))
        setState('ok')
        const anyDown = (d.results ?? []).some((r) => !r.ok)
        schedule(anyDown ? DOWN_REFRESH_MS : OK_REFRESH_MS)
      } catch {
        // Keep showing the last snapshot if a background refresh fails.
        if (cancelled) return
        setState((prev) => (prev === 'ok' ? 'ok' : 'error'))
        schedule(OK_REFRESH_MS)
      }
    }
    const resume = () => {
      if (due && watched()) tick()
    }

    tick()
    const section = document.getElementById('status')
    const observer = section
      ? new IntersectionObserver(
          ([entry]) => {
            onScreen = entry.isIntersecting
            resume()
          },
          { rootMargin: '200px' },
        )
      : null
    if (section) observer?.observe(section)
    document.addEventListener('visibilitychange', resume)

    return () => {
      cancelled = true
      clearTimeout(timer)
      observer?.disconnect()
      document.removeEventListener('visibilitychange', resume)
    }
  }, [])

  // The placeholders reserve roughly the final height (banner + two service
  // cards). Without this, content below — like the #footer anchor target —
  // jumps once the data lands, which breaks hash navigation from other pages.
  if (state === 'loading') {
    return (
      <div className="min-h-[352px]">
        <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">{t.loading}</p>
      </div>
    )
  }
  if (state === 'error' || !data) {
    return (
      <div className="min-h-[352px]">
        <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">{t.failed}</p>
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
      >
        <span
          className={`inline-block w-3 h-3 rounded-full shrink-0 ${
            neutral ? 'bg-gray-400' : allUp ? 'bg-green-500' : 'bg-red-500 animate-pulse'
          }`}
        />
        {/* The live region is the state alone: with the «Oppdatert» time in
            it, a screen reader re-read the banner on every new snapshot. */}
        <span role="status" aria-live="polite" className="font-medium text-gray-900 dark:text-white">
          {noData
            ? t.noData
            : stale
              ? t.stale
              : allUp
              ? t.allUp
              : t.someDown(downCount, results.length)}
        </span>
        <span className="basis-full sm:basis-auto sm:ml-auto text-xs font-mono text-gray-600 dark:text-gray-400">
          {t.updated}: {formatTime(lang, data.updatedAt)}
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
                  {stale ? t.lastKnown(r.ok) : r.ok ? t.up : t.down}
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
                        title={t.bar(formatTime(lang, h.at), up)}
                        className={`h-6 flex-1 min-w-0 rounded-sm ${
                          up === undefined ? 'bg-gray-300 dark:bg-gray-700' : up ? 'bg-green-500/70' : 'bg-red-500/70'
                        }`}
                      />
                    )
                  })}
                </div>
                <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                  {t.lastChecks(history.length)}
                  {history.length === HISTORY_LIMIT && (
                    <span title={t.monolith} className="text-gray-500 dark:text-gray-400">
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
