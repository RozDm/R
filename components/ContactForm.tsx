'use client'

import { useEffect, useRef, useState } from 'react'

const TURNSTILE_SITE_KEY = '0x4AAAAAADgSoi8KiO7BIBzn'

interface TurnstileWindow extends Window {
  turnstile?: {
    render: (
      el: HTMLElement | string,
      opts: { sitekey: string; callback: (token: string) => void; 'error-callback'?: () => void; theme?: 'light' | 'dark' | 'auto' },
    ) => string
    reset: (widgetId?: string) => void
  }
}

export default function ContactForm() {
  const turnstileRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')

  // Load Turnstile widget script once.
  useEffect(() => {
    if (document.querySelector('script[data-turnstile]')) return
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.turnstile = '1'
    document.head.appendChild(script)
  }, [])

  // Render the widget once the script is ready.
  useEffect(() => {
    let cancelled = false
    const tryRender = () => {
      const t = (window as TurnstileWindow).turnstile
      if (!t || !turnstileRef.current || widgetIdRef.current) return false
      widgetIdRef.current = t.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'auto',
        callback: (newToken: string) => setToken(newToken),
        'error-callback': () => setToken(null),
      })
      return true
    }
    if (tryRender()) return
    const interval = setInterval(() => {
      if (cancelled || tryRender()) clearInterval(interval)
    }, 200)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      setState('error')
      setErrorMsg('Bekreft at du ikke er en robot.')
      return
    }
    const form = event.currentTarget
    const data = new FormData(form)
    setState('sending')
    setErrorMsg('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          subject: data.get('subject'),
          message: data.get('message'),
          website: data.get('website'), // honeypot
          turnstileToken: token,
        }),
      })
      const body = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !body.ok) {
        setState('error')
        setErrorMsg(
          body.error === 'rate_limited'
            ? 'For mange forsøk. Prøv igjen senere.'
            : 'Noe gikk galt. Prøv igjen.',
        )
        ;(window as TurnstileWindow).turnstile?.reset(widgetIdRef.current ?? undefined)
        setToken(null)
        return
      }
      setState('sent')
      form.reset()
    } catch {
      setState('error')
      setErrorMsg('Nettverksfeil. Prøv igjen.')
    }
  }

  if (state === 'sent') {
    return (
      <div className="p-6 rounded-xl border border-green-500/30 bg-green-500/5 text-center">
        <p className="font-medium text-gray-900 dark:text-white">Takk! Meldingen er sendt.</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Jeg svarer så snart jeg kan.</p>
      </div>
    )
  }

  const inputClass =
    'w-full px-4 py-3 rounded-lg bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 focus:outline-none focus:border-red-500/50 text-sm font-mono text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600'

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      {/* Honeypot field — hidden from humans, often filled by bots */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute left-[-9999px] w-px h-px"
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider">Navn</span>
        <input name="name" required maxLength={120} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider">E-post</span>
        <input name="email" type="email" required maxLength={200} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider">Emne (valgfritt)</span>
        <input name="subject" maxLength={200} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider">Melding</span>
        <textarea name="message" required maxLength={4000} rows={6} className={inputClass + ' resize-y'} />
      </label>

      <div ref={turnstileRef} className="mt-2" />

      {!token && (
        <p className="text-xs font-mono text-gray-400 dark:text-gray-500">
          Vent på robotsjekken før du sender…
        </p>
      )}

      {state === 'error' && errorMsg && (
        <p className="text-sm text-red-500 dark:text-red-400 font-mono">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={state === 'sending' || !token}
        className="self-start px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-80 transition text-sm font-medium tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === 'sending' ? 'Sender…' : 'Send melding'}
      </button>
    </form>
  )
}
