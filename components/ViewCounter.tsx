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
    try {
      counted = !!sessionStorage.getItem(flag)
    } catch {}

    fetch(`/api/views/${slug}`, {
      method: counted ? 'GET' : 'POST',
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((d: { views?: number }) => {
        if (typeof d.views === 'number') setViews(d.views)
        if (!counted) {
          try {
            sessionStorage.setItem(flag, '1')
          } catch {}
        }
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
