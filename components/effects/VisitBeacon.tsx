'use client'

import { useEffect } from 'react'

// One "Besøk" per browser session. A sessionStorage flag dedupes so clicking
// through several pages counts as a single visit; the POST lets the Worker
// read request.cf.country for the geo map + the Besøk time-series. No cookie,
// nothing sent but the request itself. Renders nothing.
const KEY = 'visited'

export default function VisitBeacon() {
  useEffect(() => {
    // Set the flag BEFORE the fetch so React StrictMode's double-invoke in
    // dev (and any other concurrent mount) sees "already done" on the
    // second run and skips. A network failure is OK — the visit is rare
    // enough that one missed beacon doesn't matter; one double-counted
    // would.
    try {
      if (sessionStorage.getItem(KEY)) return
      sessionStorage.setItem(KEY, '1')
    } catch {}
    fetch('/api/visit', { method: 'POST', cache: 'no-store' }).catch(() => {})
  }, [])

  return null
}
