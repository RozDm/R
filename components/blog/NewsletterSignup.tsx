'use client'

import { useState } from 'react'

type State = 'idle' | 'sending' | 'sent' | 'already' | 'error' | 'ratelimited'

export default function NewsletterSignup() {
  const [state, setState] = useState<State>('idle')

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())
    const payload = {
      email: String(data.email ?? ''),
      consent: data.consent === 'on',
      website: String(data.website ?? ''),
      turnstileToken: null,
    }
    setState('sending')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { already?: boolean }
        form.reset()
        setState(body.already ? 'already' : 'sent')
      } else {
        setState(res.status === 429 ? 'ratelimited' : 'error')
      }
    } catch {
      setState('error')
    }
  }

  return (
    <section
      aria-label="Nyhetsbrev"
      className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800"
    >
      <p className="text-red-500 dark:text-red-400 font-mono text-xs tracking-widest uppercase mb-2">
        Nyhetsbrev
      </p>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
        Få et varsel når jeg publiserer
      </h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-xl">
        Korte mailer når nye artikler kommer — ingen sporing, ingen
        markedsføring, ingen videresalg. Du kan melde deg av når som helst.
      </p>

      {state === 'sent' && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-gray-700 dark:text-gray-200"
        >
          Takk! Du står nå på listen.
        </p>
      )}
      {state === 'already' && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
        >
          Du er allerede abonnent.
        </p>
      )}

      {state !== 'sent' && state !== 'already' && (
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 max-w-xl">
          {/* Honeypot — off-screen, hidden from AT. */}
          <div
            aria-hidden
            style={{ position: 'absolute', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
          >
            <label>
              Website
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <label className="sr-only" htmlFor="newsletter-email">E-postadresse</label>
            <input
              id="newsletter-email"
              type="email"
              name="email"
              required
              maxLength={200}
              autoComplete="email"
              placeholder="din@e-post.no"
              disabled={state === 'sending'}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-red-500/50 focus:outline-none transition-colors duration-200 ease-out disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={state === 'sending'}
              className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-80 transition-opacity duration-200 ease-out text-sm font-medium tracking-wide disabled:opacity-50"
            >
              {state === 'sending' ? 'Sender…' : 'Abonnér'}
            </button>
          </div>

          {/* GDPR: explicit, unticked-by-default opt-in. */}
          <label className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              name="consent"
              required
              className="mt-0.5 accent-red-500"
            />
            <span>
              Ja, jeg samtykker til å motta korte e-poster om nye artikler.
              IP-adresse og tidspunkt lagres som bevis på samtykket.
            </span>
          </label>

          {state === 'error' && (
            <p className="text-sm text-red-500 dark:text-red-400" role="alert">
              Noe gikk galt. Prøv igjen om litt.
            </p>
          )}
          {state === 'ratelimited' && (
            <p className="text-sm text-red-500 dark:text-red-400" role="alert">
              For mange forsøk på kort tid — prøv igjen om en stund.
            </p>
          )}
        </form>
      )}
    </section>
  )
}
