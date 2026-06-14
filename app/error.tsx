'use client'

// Client-side error boundary for the whole app. Renders a calm dark page in
// the site's voice instead of the bare Next.js dev overlay or a blank screen
// when something goes wrong inside a client component.

import Link from 'next/link'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface the digest in DevTools without leaking the stack to users.
    if (process.env.NODE_ENV !== 'production') console.error(error)
  }, [error])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-10" aria-hidden>
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[radial-gradient(circle,#ff2020_0%,#cc0000_25%,#800000_45%,#3d0000_65%,#1a0a0a_100%)] shadow-[0_0_50px_10px_rgba(255,0,0,0.2)]" />
        <div className="absolute inset-[34%] rounded-full bg-[radial-gradient(circle,rgba(255,200,100,0.9)_0%,rgba(255,50,0,0.6)_100%)]" />
      </div>

      <p className="font-mono text-sm tracking-widest text-red-500 dark:text-red-400 uppercase mb-4">
        Systemfeil
      </p>
      <h1 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-white max-w-2xl leading-tight">
        Noe gikk galt. Jeg er redd jeg ikke kan fortsette akkurat nå.
      </h1>
      {error.digest && (
        <p className="mt-6 font-mono text-xs text-gray-400 dark:text-gray-600">
          {`// ${error.digest}`}
        </p>
      )}

      <div className="mt-10 flex gap-4">
        <button
          onClick={reset}
          className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-80 transition text-sm font-medium tracking-wide"
        >
          Prøv på nytt
        </button>
        <Link
          href="/"
          className="px-6 py-3 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:border-gray-500 dark:hover:border-gray-500 transition text-sm font-medium tracking-wide"
        >
          Tilbake til forsiden
        </Link>
      </div>
    </main>
  )
}
