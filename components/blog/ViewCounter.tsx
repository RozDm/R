'use client'

import { useEffect, useState } from 'react'
import { DICT } from '@/data/i18n'
import { useLang } from '@/lib/use-lang'
import { onFirstHumanInput } from '@/lib/visit'

// Below this the count stays hidden: «4 visninger» reads as an empty site.
// D1 still counts every view; the number appears once it's worth showing.
const MIN_SHOWN = 50

// Counts one view per browser session per post (sessionStorage flag), so a
// reader hopping back and forth doesn't inflate the number — and, like the
// Besøk beacon (lib/visit.ts), only on the first human input and never under
// automation, so headless loaders and prefetchers don't count. `slug` is the
// post's view key (lib/blog.ts viewKey): both language versions share it.
export default function ViewCounter({ slug }: { slug: string }) {
  const [views, setViews] = useState<number | null>(null)
  const t = DICT[useLang()].blog

  useEffect(() => {
    const controller = new AbortController()
    const flag = `viewed:${slug}`
    const load = (method: 'GET' | 'POST') =>
      fetch(`/api/views/${slug}`, { method, signal: controller.signal, cache: 'no-store' })
        .then((r) => r.json())
        .then((d: { views?: number }) => {
          if (typeof d.views === 'number') setViews(d.views)
        })
        .catch(() => {})
    const counted = () => {
      try {
        return !!sessionStorage.getItem(flag)
      } catch {
        return false
      }
    }

    // Already counted this session, or a browser under automation: just read.
    if (counted() || navigator.webdriver) {
      load('GET')
      return () => controller.abort()
    }
    // Otherwise the count arrives with the POST's answer; it stays hidden
    // under MIN_SHOWN anyway. Set the flag BEFORE the fetch (same rule as
    // VisitBeacon) so StrictMode's double-invoke and remount races fall back
    // to a GET. A failed POST loses one view at most; counting twice is worse.
    const stop = onFirstHumanInput(() => {
      if (counted()) return void load('GET')
      try {
        sessionStorage.setItem(flag, '1')
      } catch {}
      load('POST')
    })
    return () => {
      stop()
      controller.abort()
    }
  }, [slug])

  if (views === null || views < MIN_SHOWN) return null
  return (
    <span>
      {' · '}
      {t.views(views)}
    </span>
  )
}
