// Uptime monitoring: monitor list and the (pure) KV snapshot logic.

// Endpoints the uptime cron checks. Add your own services here.
// `internal: true` checks via the ASSETS binding (a Worker can't fetch its own
// public URL — Cloudflare blocks the loop). External services use plain fetch.
export const MONITORS: { name: string; url: string; internal?: boolean }[] = [
  { name: 'Grafana', url: 'https://grafana.com/' },
]

export const STATUS_KEY = 'status'
export const HISTORY_LIMIT = 96 // ~8h at one check / 5 min

export interface MonitorResult {
  name: string
  url: string
  ok: boolean
  status: number
  ms: number
}

// One cron tick: per-monitor up/down keyed by monitor name, so the dashboard
// can draw an uptime bar per service instead of one aggregated bar.
export interface HistoryEntry {
  at: string
  up: Record<string, boolean>
}

export interface StatusData {
  updatedAt: string
  results: MonitorResult[]
  history: HistoryEntry[]
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as { at?: unknown; up?: unknown }
  return typeof entry.at === 'string' && typeof entry.up === 'object' && entry.up !== null
}

// Merge fresh results into the stored snapshot. Entries in the old format
// (aggregated `up: boolean`) are dropped, as is anything unparsable.
export function buildStatusData(raw: string | null, results: MonitorResult[], updatedAt: string): StatusData {
  let history: HistoryEntry[] = []
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      const prev = (parsed as { history?: unknown }).history
      if (Array.isArray(prev)) history = prev.filter(isHistoryEntry)
    } catch {}
  }
  history.push({
    at: updatedAt,
    up: Object.fromEntries(results.map((r) => [r.name, r.ok])),
  })
  if (history.length > HISTORY_LIMIT) history = history.slice(-HISTORY_LIMIT)
  return { updatedAt, results, history }
}
