'use client'

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { useTheme } from '@/context/ThemeContext'

// Minimal Turnstile widget wrapper. Lazy-loads the Cloudflare script on mount,
// renders into our div, and surfaces the token via onToken. We use 'always'
// appearance so the widget renders openly — silent modes trip strict
// Tracking Prevention in Edge/Brave with noisy console warnings even though
// the challenge itself still works.

interface TurnstileGlobal {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      theme?: 'auto' | 'light' | 'dark'
      appearance?: 'always' | 'execute' | 'interaction-only'
      callback?: (token: string) => void
      'error-callback'?: () => void
      'expired-callback'?: () => void
      'timeout-callback'?: () => void
    },
  ) => string
  remove: (widgetId: string) => void
  reset: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileGlobal
    onloadTurnstileCallback?: () => void
  }
}

// Imperative handle for the parent form. Turnstile tokens are single-use:
// siteverify consumes the token even when the request then fails (rate limit,
// mail error), so after any non-OK response the form must reset the widget to
// get a fresh token — re-sending the spent one is rejected with 403.
export interface TurnstileHandle {
  reset: () => void
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit'

// A script that neither loads nor fails (a stalled connection) counts as
// failed after this, so the form points to e-mail instead of asking for a
// challenge no widget is there to show.
const LOAD_TIMEOUT_MS = 10_000

// One load per document, shared by every mount. A failed load is forgotten
// and its dead <script> removed, so the next mount (a return to the form by
// client-side navigation) tries again — and reports again if it fails.
let loading: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (loading) return loading
  const attempt = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('turnstile load timed out')), LOAD_TIMEOUT_MS)
    window.onloadTurnstileCallback = () => {
      clearTimeout(timer)
      resolve()
    }
    // A script still in flight from a timed-out attempt is waited on again,
    // not added twice.
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    if (!script) {
      script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      document.head.appendChild(script)
    }
    const s = script
    s.addEventListener(
      'error',
      () => {
        clearTimeout(timer)
        s.remove()
        reject(new Error('turnstile load failed'))
      },
      { once: true },
    )
  })
  loading = attempt
  attempt.catch(() => {
    if (loading === attempt) loading = null
  })
  return attempt
}

// The site's theme as the page shows it (the <head> script sets the class
// before paint, so it is right even before ThemeContext has synced).
function siteTheme(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export default function Turnstile({
  siteKey,
  onToken,
  onError,
  ref: handleRef,
}: {
  siteKey: string
  onToken: (token: string | null) => void
  onError?: () => void
  ref?: Ref<TurnstileHandle>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  // A dependency only: the widget can't restyle itself, so a flip of the
  // site's theme renders it again in the new one ('auto' would follow the OS,
  // not the toggle). A re-render issues a fresh token.
  const { theme } = useTheme()

  useImperativeHandle(
    handleRef,
    () => ({
      reset: () => {
        onToken(null)
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(widgetIdRef.current)
          } catch {}
        }
      },
    }),
    [onToken],
  )

  useEffect(() => {
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          theme: siteTheme(),
          appearance: 'always',
          callback: (token) => onToken(token),
          'error-callback': () => {
            onToken(null)
            onError?.()
          },
          'expired-callback': () => onToken(null),
          'timeout-callback': () => onToken(null),
        })
      })
      .catch(() => {
        if (!cancelled) onError?.()
      })
    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {}
      }
      widgetIdRef.current = null
    }
  }, [siteKey, onToken, onError, theme])

  return <div ref={ref} />
}
