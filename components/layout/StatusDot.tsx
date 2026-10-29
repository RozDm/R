'use client'

import { useEffect, useRef, useState } from 'react'
import { isStale } from '@/src/status'
import { fetchStatus } from '@/lib/status-fetch'
import { DICT } from '@/data/i18n'
import { useLang } from '@/lib/use-lang'
import { useNearViewport } from '@/lib/use-near-viewport'

type DotState = 'unknown' | 'up' | 'down'

// One fetch, no polling: the footer is on every page and only needs an honest
// hint, not a live dashboard — and only once the footer nears the viewport
// (lib/use-near-viewport.ts), so a reader who never scrolls down costs no
// Worker request for it. Unknown/error/stale degrades to gray.
// Same visual language as the dashboard: steady green when all is well, a
// pulsing red only when something is down (movement means "look at me").
export default function StatusDot() {
  const [state, setState] = useState<DotState>('unknown')
  const label = DICT[useLang()].footer.dot
  const ref = useRef<HTMLSpanElement>(null)
  const near = useNearViewport(ref, '200px')

  useEffect(() => {
    if (!near) return
    let cancelled = false
    // Shared with the front page's dashboard: one request (lib/status-fetch.ts).
    fetchStatus()
      .then((d) => {
        const results = d.results || []
        if (cancelled || results.length === 0) return
        // A frozen snapshot can't vouch for anything — stay gray.
        if (!d.updatedAt || isStale(d.updatedAt, Date.now())) return
        setState(results.every((r) => r.ok) ? 'up' : 'down')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [near])

  const color =
    state === 'up' ? 'bg-green-500' : state === 'down' ? 'bg-red-500 animate-pulse' : 'bg-gray-400'

  return (
    <>
      <span ref={ref} aria-hidden className={`inline-block w-2 h-2 rounded-full ${color}`} />
      <span className="sr-only">{`(${label[state]})`}</span>
    </>
  )
}
