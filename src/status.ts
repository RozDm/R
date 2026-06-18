// Uptime monitoring: monitor list and the (pure) KV snapshot logic.

// Endpoints the uptime cron checks. Add your own services here.
// `internal: true` checks via the ASSETS binding (a Worker can't fetch its own
// public URL — Cloudflare blocks the loop). External services use plain fetch.
export const MONITORS: { name: string; url: string; internal?: boolean }[] = [
  { name: 'NetBox', url: 'https://guku7579.cloud.netboxapp.com/' },
  { name: 'Grafana', url: 'https://rozsoshnykh.grafana.net/' },
]

export const STATUS_KEY = 'status'
// 149 = the monolith's proportions, 1² : 2² : 3² (1:4:9). ~12.5h at one
// check / 5 min.
export const HISTORY_LIMIT = 149

// Bound each external probe. Without it a host that accepts the connection but
// never responds leaves the fetch pending — Promise.all then waits on it,
// inflating the recorded latency and blurring "slow" vs. "down". On timeout the
// fetch throws and the probe is recorded as down (ok = false, ms ≈ this value).
export const MONITOR_TIMEOUT_MS = 10_000

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

// Parse the stored snapshot's history (or [] if empty/malformed/legacy). Shared
// between buildStatusData (to append onto) and detectTransitions (to compare
// against), so the "drop legacy aggregated up: boolean" rule lives in one place.
export function parseHistory(raw: string | null): HistoryEntry[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    const prev = (parsed as { history?: unknown }).history
    if (Array.isArray(prev)) return prev.filter(isHistoryEntry)
  } catch {}
  return []
}

// Merge fresh results into the stored snapshot. Entries in the old format
// (aggregated `up: boolean`) are dropped, as is anything unparsable.
export function buildStatusData(raw: string | null, results: MonitorResult[], updatedAt: string): StatusData {
  let history = parseHistory(raw)
  history.push({
    at: updatedAt,
    up: Object.fromEntries(results.map((r) => [r.name, r.ok])),
  })
  if (history.length > HISTORY_LIMIT) history = history.slice(-HISTORY_LIMIT)
  return { updatedAt, results, history }
}

// Per-monitor up/down transitions vs. the previous tick. First-ever runs and
// newly-added monitors emit nothing — no prior boolean to compare against, so
// we don't fire a misleading "down" alert on deploy. A single missed cron
// tick simply delays detection by 5 minutes, never invents one.
export function detectTransitions(
  previousHistory: HistoryEntry[],
  results: MonitorResult[],
): MonitorResult[] {
  if (previousHistory.length === 0) return []
  const last = previousHistory[previousHistory.length - 1].up
  return results.filter((r) => {
    const wasUp = last[r.name]
    return typeof wasUp === 'boolean' && wasUp !== r.ok
  })
}
