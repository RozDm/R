'use client'

import { useEffect } from 'react'
import { HUMAN_EVENTS, VISIT_DAY_KEY, localDay, shouldCountVisit } from '@/lib/visit'

// One "Besøk" per browser per day, sent on the first human input — the rules
// and why are in lib/visit.ts. The POST lets the Worker read
// request.cf.country for the geo map + the Besøk time-series. No cookie,
// nothing sent but the request itself; the browser keeps only today's date.
// Renders nothing.

// Where localStorage is blocked, this at least keeps one visit per page load.
let countedThisLoad = false

function readDay(): string | null {
  try {
    return localStorage.getItem(VISIT_DAY_KEY)
  } catch {
    return countedThisLoad ? localDay(new Date()) : null
  }
}

export default function VisitBeacon() {
  useEffect(() => {
    const today = () => localDay(new Date())
    if (!shouldCountVisit({ webdriver: navigator.webdriver, lastDay: readDay(), today: today() })) return

    const opts = { capture: true, passive: true } as const
    const stop = () => HUMAN_EVENTS.forEach((t) => window.removeEventListener(t, onInput, opts))
    function onInput(e: Event) {
      // A script's dispatchEvent is untrusted; real input and the browser's
      // own events are trusted.
      if (!e.isTrusted) return
      stop()
      // Re-check, then set the flag BEFORE the fetch: another tab may have
      // counted today meanwhile, and StrictMode/remounts must not double up.
      const day = today()
      if (readDay() === day) return
      countedThisLoad = true
      try {
        localStorage.setItem(VISIT_DAY_KEY, day)
      } catch {}
      // A failed request is a missed visit — rare, and better than a double.
      fetch('/api/visit', { method: 'POST', cache: 'no-store' }).catch(() => {})
    }
    HUMAN_EVENTS.forEach((t) => window.addEventListener(t, onInput, opts))
    return stop
  }, [])

  return null
}
