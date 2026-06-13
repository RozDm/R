'use client'

import { useState } from 'react'

type FormState = 'idle' | 'sending' | 'sent' | 'error' | 'ratelimited'

const inputClass =
  'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-red-500/50 focus:outline-none transition-colors'

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
  const [state, setState] = useState<FormState>('idle')

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())
    setState('sending')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        form.reset()
        setState('sent')
      } else {
        setState(res.status === 429 ? 'ratelimited' : 'error')
      }
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6" role="status">
        <p className="font-medium text-gray-900 dark:text-white">Takk! Meldingen er sendt.</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Jeg svarer som regel innen en dag eller to.</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-xl">
      {/* Honeypot: hidden from humans, irresistible to bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-900 dark:text-white">Navn</span>
        <input
          name="name"
          required
          maxLength={100}
          autoComplete="name"
          className={inputClass}
          onInvalid={validity('Skriv inn navnet ditt.')}
          onInput={clearValidity}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-900 dark:text-white">E-post</span>
        <input
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          className={inputClass}
          onInvalid={validity('Skriv inn en gyldig e-postadresse.')}
          onInput={clearValidity}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-900 dark:text-white">Melding</span>
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          className={inputClass}
          onInvalid={validity('Meldingen må være minst 10 tegn.')}
          onInput={clearValidity}
        />
      </label>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={state === 'sending'}
          className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-80 transition text-sm font-medium tracking-wide disabled:opacity-50"
        >
          {state === 'sending' ? 'Sender…' : 'Send melding'}
        </button>
        {state === 'error' && (
          <p className="text-sm text-red-500 dark:text-red-400" role="alert">
            Noe gikk galt. Prøv igjen, eller send en e-post direkte.
          </p>
        )}
        {state === 'ratelimited' && (
          <p className="text-sm text-red-500 dark:text-red-400" role="alert">
            For mange meldinger på kort tid — prøv igjen om noen minutter.
          </p>
        )}
      </div>
    </form>
  )
}
