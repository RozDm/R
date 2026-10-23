// When the Besøk beacon (components/effects/VisitBeacon.tsx) may count a
// visit — and, with onFirstHumanInput, when a post view counts
// (components/blog/ViewCounter.tsx). Pure, so it is unit-tested (tests/visit-beacon.test.ts); the
// browser side is covered by e2e/site.e2e.ts.
//
// The aim is people, not page loads: a visit counts
//   - once per browser per local day (a localStorage date, not a per-tab
//     session — several tabs or a return later that day are one visit);
//   - only after the first trusted human input — a pointer moving or pressing,
//     a touch, a key, a wheel turn; never on load, so prefetchers, preview
//     renderers and headless loaders that never touch the page don't count;
//   - never in a browser under automation (navigator.webdriver — set by
//     Selenium, Puppeteer and Playwright even behind a normal User-Agent).
// The Worker's own filters (isWriteAllowed, datacenter ASNs, the rate
// limiter) still apply on top.

export const VISIT_DAY_KEY = 'visit-day'

// `scroll` is left out on purpose: a script can scroll the page, and its
// scroll events are trusted.
export const HUMAN_EVENTS = ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel'] as const

const pad = (n: number) => String(n).padStart(2, '0')

/** The visitor's own calendar day, YYYY-MM-DD. */
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function shouldCountVisit(opts: { webdriver: boolean; lastDay: string | null; today: string }): boolean {
  return !opts.webdriver && opts.lastDay !== opts.today
}

// Runs `callback` once, on the first trusted HUMAN_EVENTS input; returns the
// unsubscribe for an effect's cleanup. A script's dispatchEvent is untrusted,
// real input is trusted. Shared by the Besøk beacon and the post ViewCounter,
// so both count people the same way.
export function onFirstHumanInput(callback: () => void): () => void {
  const opts = { capture: true, passive: true } as const
  const stop = () => HUMAN_EVENTS.forEach((t) => window.removeEventListener(t, onInput, opts))
  function onInput(e: Event) {
    if (!e.isTrusted) return
    stop()
    callback()
  }
  HUMAN_EVENTS.forEach((t) => window.addEventListener(t, onInput, opts))
  return stop
}
