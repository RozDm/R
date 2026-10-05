'use client'

import { useEffect, useState } from 'react'
import { isStale } from '@/src/status'
import { DICT } from '@/data/i18n'
import { useLang } from '@/lib/use-lang'

type DotState = 'unknown' | 'up' | 'down'

// One fetch on mount, no polling: the footer is on every page and only needs
// an honest hint, not a live dashboard. Unknown/error/stale degrades to gray.
// Same visual language as the dashboard: steady green when all is well, a
// pulsing red only when something is down (movement means "look at me").
export default function StatusDot() {
  const [state, setState] = useState<DotState>('unknown')
  const label = DICT[useLang()].footer.dot

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/status', { signal: controller.signal, cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { updatedAt?: string; results?: { ok: boolean }[] }) => {
        const results = d.results || []
        if (results.length === 0) return
        // A frozen snapshot can't vouch for anything — stay gray.
        if (!d.updatedAt || isStale(d.updatedAt, Date.now())) return
        setState(results.every((r) => r.ok) ? 'up' : 'down')
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const color =
    state === 'up' ? 'bg-green-500' : state === 'down' ? 'bg-red-500 animate-pulse' : 'bg-gray-400'

  return (
    <>
      <span aria-hidden className={`inline-block w-2 h-2 rounded-full ${color}`} />
      <span className="sr-only">{`(${label[state]})`}</span>
    </>
  )
}
