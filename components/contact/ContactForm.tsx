'use client'

import { useCallback, useRef, useState } from 'react'
import Turnstile, { type TurnstileHandle } from './Turnstile'
import { DICT } from '@/data/i18n'
import { useLang } from '@/lib/use-lang'

type FormState =
  | 'idle'
  | 'sending'
  | 'sent'
  | 'error'
  | 'invalid'
  | 'ratelimited'
  | 'challenge'
  | 'blocked'

const CONTACT_EMAIL = 'contact@rozsoshnykh.no'

// Set at build time from CF Turnstile (Site Key). Empty -> widget is not
// rendered and the worker also leaves the check off when its secret is
// unset, so deploys stay safe without keys configured.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

const inputClass =
  'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-red-500/50 focus:outline-none transition-colors duration-200 ease-out'

type Field = HTMLInputElement | HTMLTextAreaElement

// Force a Norwegian browser-validation bubble instead of the browser-locale
// default; clearValidity lets the field re-validate as the user types.
const validity = (message: string) => (e: React.FormEvent<Field>) => {
  e.currentTarget.setCustomValidity(message)
}
const clearValidity = (e: React.FormEvent<Field>) => {
  e.currentTarget.setCustomValidity('')
}

export default function ContactForm() {
  const t = DICT[useLang()].contact
  const [state, setState] = useState<FormState>('idle')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileHandle>(null)

  const onToken = useCallback((token: string | null) => setTurnstileToken(token), [])

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (SITE_KEY && !turnstileToken) {
      setState('challenge')
      return
    }
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())
    setState('sending')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, turnstileToken }),
      })
      if (res.ok) {
        form.reset()
        setTurnstileToken(null)
        setState('sent')
      } else {
        // The server verified (and thereby spent) the single-use token before
        // it rate-limited or failed to mail, so a retry needs a fresh one.
        turnstileRef.current?.reset()
        // A 403 without a Turnstile widget on the page means the server-side
        // filters (Sec-Fetch / UA) refused the request — asking the user to
        // "confirm you're not a bot" would point at a challenge that doesn't
        // exist. Send them to e-mail instead.
        setState(
          res.status === 429
            ? 'ratelimited'
            : res.status === 422
              ? 'invalid'
              : res.status === 403
                ? SITE_KEY
                  ? 'challenge'
                  : 'blocked'
                : 'error',
        )
      }
    } catch {
      turnstileRef.current?.reset()
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6" role="status">
        <p className="font-medium text-gray-900 dark:text-white">{t.sentTitle}</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t.sentBody}</p>
        <button
          onClick={() => setState('idle')}
          className="mt-4 text-sm font-mono text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 ease-out"
        >
          {t.sendAnother} &rarr;
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-xl">
      {/* Honeypot: off-screen rather than display:none, since modern bots
          increasingly skip display:none. Hidden from assistive tech via
          aria-hidden and tabIndex={-1}. */}
      <div
        aria-hidden
        style={{ position: 'absolute', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
      >
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{t.name}</span>
        <input
          name="name"
          required
          maxLength={100}
          autoComplete="name"
          className={inputClass}
          onInvalid={validity(t.nameInvalid)}
          onInput={clearValidity}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{t.email}</span>
        <input
          name="email"
          type="email"
          required
          maxLength={200}
          // Same shape the worker enforces (src/contact.ts EMAIL_RE): the
          // browser's own type=email accepts "a@b" with no TLD, which the
          // server then rejects.
          pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}"
          autoComplete="email"
          className={inputClass}
          onInvalid={validity(t.emailInvalid)}
          onInput={clearValidity}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{t.message}</span>
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          className={inputClass}
          onInvalid={validity(t.messageInvalid)}
          onInput={clearValidity}
        />
      </label>

      {SITE_KEY && <Turnstile ref={turnstileRef} siteKey={SITE_KEY} onToken={onToken} />}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={state === 'sending'}
          className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-80 transition-opacity duration-200 ease-out text-sm font-medium tracking-wide disabled:opacity-50"
        >
          {state === 'sending' ? t.sending : t.send}
        </button>
        {state === 'error' && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {t.errorFailed}{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:no-underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        )}
        {state === 'invalid' && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {t.errorInvalid}
          </p>
        )}
        {state === 'ratelimited' && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {t.errorRate}
          </p>
        )}
        {state === 'challenge' && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {t.errorChallenge}
          </p>
        )}
        {state === 'blocked' && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {t.errorBlocked}{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:no-underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        )}
      </div>
    </form>
  )
}
