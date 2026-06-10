'use client'

import { useEffect, useState } from 'react'

type DotState = 'unknown' | 'up' | 'down'

// One fetch on mount, no polling: the footer is on every page and only needs
// an honest hint, not a live dashboard. Unknown/error degrades to gray.
export default function StatusDot() {
  const [state, setState] = useState<DotState>('unknown')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/status', { signal: controller.signal, cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { results?: { ok: boolean }[] }) => {
        const results = d.results || []
        if (results.length === 0) return
        setState(results.every((r) => r.ok) ? 'up' : 'down')
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const color =
    state === 'up' ? 'bg-green-500 animate-pulse' : state === 'down' ? 'bg-red-500' : 'bg-gray-400'

  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
}
