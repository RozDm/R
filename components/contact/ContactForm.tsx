'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Turnstile, { type TurnstileHandle } from './Turnstile'
import { DICT } from '@/data/i18n'
import { useLang } from '@/lib/use-lang'
import { CONTACT_ADDRESS, CONTACT_LIMITS, EMAIL_PATTERN, HONEYPOT_FIELD } from '@/src/contact'

type FormState =
  | 'idle'
  | 'sending'
  | 'sent'
  | 'error'
  | 'invalid'
  | 'ratelimited'
  | 'challenge'
  | 'blocked'
  | 'widget'


// Set at build time from CF Turnstile (Site Key). Empty -> widget is not
// rendered and the worker also leaves the check off when its secret is
// unset, so deploys stay safe without keys configured.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

const inputClass =
  'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-red-500/50 focus:outline-none transition-colors duration-200 ease-out'

type Field = HTMLInputElement | HTMLTextAreaElement

// What a refused submission means, from the status and the Worker's
// `{"error": …}` (src/routes/contact.ts). Only a Turnstile refusal asks the
// visitor to solve the challenge; the Sec-Fetch/UA filter ("forbidden") and
// anything that isn't the Worker's own answer (an edge 429 when the daily
// request quota is spent) send them to e-mail instead.
function refusedState(status: number, error: unknown): FormState {
  if (status === 429) return error === 'rate limited' ? 'ratelimited' : 'error'
  if (status === 422) return 'invalid'
  if (status === 403) {
    return SITE_KEY && (error === 'challenge required' || error === 'challenge failed') ? 'challenge' : 'blocked'
  }
  return 'error'
}

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

  // The form and its confirmation replace each other, so the element that had
  // focus (the submit button, then «Send en til») is unmounted and focus
  // would fall back to <body>: a keyboard or screen-reader user is thrown to
  // the top of the page, and a status region that appears together with its
  // text is often not announced at all. Move focus instead — to the
  // confirmation's heading, which a screen reader then reads with the line
  // under it, and back to the first field for the next message.
  const sentRef = useRef<HTMLHeadingElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const sentBodyId = useId()
  const wasSent = useRef(false)
  useEffect(() => {
    if (state === 'sent') sentRef.current?.focus()
    else if (wasSent.current) nameRef.current?.focus()
    wasSent.current = state === 'sent'
  }, [state])

  // A fresh token clears a challenge prompt, and a widget that failed to
  // load but recovered clears its notice.
  const onToken = useCallback((token: string | null) => {
    setTurnstileToken(token)
    if (token) setState((s) => (s === 'challenge' || s === 'widget' ? 'idle' : s))
  }, [])
  // The widget's script was blocked or the widget errored: no challenge can be
  // solved here, so say so (with the e-mail) instead of asking for one.
  const onWidgetError = useCallback(() => setState((s) => (s === 'idle' || s === 'challenge' ? 'widget' : s)), [])

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (SITE_KEY && !turnstileToken) {
      setState((s) => (s === 'widget' ? 'widget' : 'challenge'))
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
        const error = await res.json().then(
          (d: { error?: unknown } | null) => d?.error,
          () => null,
        )
        setState(refusedState(res.status, error))
      }
    } catch {
      turnstileRef.current?.reset()
      setState('error')
    }
  }

  // The refusal, if any; `mail` appends the address where the form can't help.
  const message =
    state === 'error' ? { text: t.errorFailed, mail: true }
    : state === 'invalid' ? { text: t.errorInvalid, mail: false }
    : state === 'ratelimited' ? { text: t.errorRate, mail: true }
    : state === 'challenge' ? { text: t.errorChallenge, mail: false }
    : state === 'blocked' ? { text: t.errorBlocked, mail: true }
    : state === 'widget' ? { text: t.errorWidget, mail: true }
    : null

  if (state === 'sent') {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6">
        <h2
          ref={sentRef}
          tabIndex={-1}
          aria-describedby={sentBodyId}
          className="font-medium text-gray-900 dark:text-white"
        >
          {t.sentTitle}
        </h2>
        <p id={sentBodyId} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t.sentBody}
        </p>
        <button
          onClick={() => setState('idle')}
          className="mt-4 text-sm font-mono text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 ease-out"
        >
          {t.sendAnother} &rarr;
        </button>
      </div>
    )
  }

  // The form is a fetch() behind a Turnstile check, so without JavaScript it
  // can't send: a submit would be the browser's own, a GET with the message
  // in the address bar and no answer. Say so instead (<noscript>), hide the
  // fields that would lead nowhere (the scripting media query — a browser too
  // old for it keeps them, under the note), and make that native submit a
  // POST so the message at least never lands in a URL.
  return (
    <form
      onSubmit={onSubmit}
      method="post"
      className="flex flex-col gap-4 max-w-xl [@media(scripting:none)]:[&>:not(noscript)]:hidden"
    >
      <noscript>
        <p className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-5 text-sm text-gray-900 dark:text-white">
          {t.noscript}{' '}
          <a href={`mailto:${CONTACT_ADDRESS}`} className="text-red-600 dark:text-red-400 underline underline-offset-2 hover:decoration-2">
            {CONTACT_ADDRESS}
          </a>
          .
        </p>
      </noscript>

      {/* Honeypot: off-screen rather than display:none, since modern bots
          increasingly skip display:none. Hidden from assistive tech via
          aria-hidden and tabIndex={-1}. Classes, not an inline style: a
          browser without style-src-attr (Safari < 15.4) falls back to
          style-src 'self' and would show an inline-styled honeypot. Named
          and labelled "topic", not website/url/company: autofill and
          password managers fill those, and a filled honeypot drops a real
          message as "sent" (HONEYPOT_FIELD, shared with the Worker). */}
      <div aria-hidden className="absolute -left-[9999px] top-auto w-px h-px overflow-hidden">
        <label>
          Topic
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{t.name}</span>
        <input
          ref={nameRef}
          name="name"
          required
          maxLength={CONTACT_LIMITS.name}
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
          maxLength={CONTACT_LIMITS.email}
          // The rule the Worker enforces (src/contact.ts): the browser's own
          // type=email accepts "a@b" or a quoted local part, which the Worker
          // would then refuse with a 422.
          pattern={EMAIL_PATTERN}
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
          minLength={CONTACT_LIMITS.messageMin}
          maxLength={CONTACT_LIMITS.message}
          rows={6}
          className={inputClass}
          onInvalid={validity(t.messageInvalid)}
          onInput={clearValidity}
        />
      </label>

      {SITE_KEY && <Turnstile ref={turnstileRef} siteKey={SITE_KEY} onToken={onToken} onError={onWidgetError} />}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={state === 'sending'}
          className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-80 transition-opacity duration-200 ease-out text-sm font-medium tracking-wide disabled:opacity-50"
        >
          {state === 'sending' ? t.sending : t.send}
        </button>
        {message && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {message.text}
            {message.mail && (
              <>
                {' '}
                <a href={`mailto:${CONTACT_ADDRESS}`} className="underline hover:no-underline">
                  {CONTACT_ADDRESS}
                </a>
                .
              </>
            )}
          </p>
        )}
      </div>
    </form>
  )
}
