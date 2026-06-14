'use client'

// Last-resort error boundary that catches errors thrown by the root layout
// itself. Must render its own <html>/<body>; no Header/Footer available here.

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') console.error(error)
  }, [error])

  return (
    <html lang="nb">
      <body style={{ margin: 0, background: '#030712', color: '#e2e8f0', fontFamily: 'ui-monospace, monospace' }}>
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, maxWidth: 600 }}>
            Noe gikk veldig galt.
          </h1>
          <button
            onClick={reset}
            style={{ marginTop: 32, padding: '12px 24px', background: '#fff', color: '#0f172a', border: 'none', borderRadius: 8, fontWeight: 500, cursor: 'pointer' }}
          >
            Prøv på nytt
          </button>
        </main>
      </body>
    </html>
  )
}
