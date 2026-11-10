'use client'

// Client-side error boundary for the whole app. Renders a calm dark page in
// the site's voice instead of the bare Next.js dev overlay or a blank screen
// when something goes wrong inside a client component.

import Link from 'next/link'
import { useEffect } from 'react'
import HalEye from '@/components/effects/HalEye'
import Eyebrow from '@/components/layout/Eyebrow'
import { ERROR_COPY } from '@/data/i18n-error'
import { localePath } from '@/lib/i18n'
import { useLang } from '@/lib/use-lang'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const lang = useLang()
  const t = ERROR_COPY[lang]
  useEffect(() => {
    // Surface the digest in DevTools without leaking the stack to users.
    if (process.env.NODE_ENV !== 'production') console.error(error)
  }, [error])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <HalEye look="page" className="mb-10" />

      <Eyebrow className="mb-4">{t.error.eyebrow}</Eyebrow>
      <h1 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-white max-w-2xl leading-tight">
        {t.error.title}
      </h1>
      {error.digest && (
        <p className="mt-6 font-mono text-xs text-gray-500 dark:text-gray-400">
          {`// ${error.digest}`}
        </p>
      )}

      <div className="mt-10 flex gap-4">
        <button
          onClick={reset}
          className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-80 transition text-sm font-medium tracking-wide"
        >
          {t.error.retry}
        </button>
        <Link
          href={localePath(lang, '/')}
          className="px-6 py-3 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:border-gray-500 dark:hover:border-gray-500 transition text-sm font-medium tracking-wide"
        >
          {t.backHome}
        </Link>
      </div>
    </main>
  )
}
