'use client'

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'

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

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  return new Promise((resolve, reject) => {
    window.onloadTurnstileCallback = () => resolve()
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    if (existing) return
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onerror = () => reject(new Error('turnstile load failed'))
    document.head.appendChild(s)
  })
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
          theme: 'auto',
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
      .catch(() => onError?.())
    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {}
      }
    }
  }, [siteKey, onToken, onError])

  return <div ref={ref} />
}
