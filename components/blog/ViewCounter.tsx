'use client'

import { useEffect, useState } from 'react'

// Counts one view per browser session per post (sessionStorage flag), so a
// reader hopping back and forth doesn't inflate the number.
export default function ViewCounter({ slug }: { slug: string }) {
  const [views, setViews] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const flag = `viewed:${slug}`
    let counted = false
    // Set the flag BEFORE the fetch (same rule as VisitBeacon) so StrictMode's
    // dev double-invoke and remount races see "already counted" and fall back
    // to GET. A failed POST loses one view at most; counting twice is worse.
    try {
      counted = !!sessionStorage.getItem(flag)
      if (!counted) sessionStorage.setItem(flag, '1')
    } catch {}

    fetch(`/api/views/${slug}`, {
      method: counted ? 'GET' : 'POST',
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((d: { views?: number }) => {
        if (typeof d.views === 'number') setViews(d.views)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [slug])

  if (views === null) return null
  return (
    <span>
      {' · '}
      {views} {views === 1 ? 'visning' : 'visninger'}
    </span>
  )
}
