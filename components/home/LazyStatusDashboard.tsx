'use client'

import dynamic from 'next/dynamic'

// Code-split the dashboard out of the initial bundle: it sits below the fold
// and fetches its own data on the client, so there is nothing to render on the
// server. The fallback reserves the final height to avoid layout shift (and to
// keep the #footer hash target stable) and reuses the 2001 loading line.
const StatusDashboard = dynamic(() => import('./StatusDashboard'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[352px]">
      <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">Åpner podbay-dørene…</p>
    </div>
  ),
})

export default function LazyStatusDashboard() {
  return <StatusDashboard />
}
