'use client'

import { useEffect } from 'react'

// One "Besøk" per browser session. A sessionStorage flag dedupes so clicking
// through several pages counts as a single visit; the POST lets the Worker
// read request.cf.country for the geo map + the Besøk time-series. No cookie,
// nothing sent but the request itself. Renders nothing.
const KEY = 'visited'

export default function VisitBeacon() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) return
    } catch {}
    fetch('/api/visit', { method: 'POST', cache: 'no-store' })
      .then(() => {
        try {
          sessionStorage.setItem(KEY, '1')
        } catch {}
      })
      .catch(() => {})
  }, [])

  return null
}
