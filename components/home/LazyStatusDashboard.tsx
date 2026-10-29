'use client'

import dynamic from 'next/dynamic'
import { useRef } from 'react'
import { DICT } from '@/data/i18n'
import { useLang } from '@/lib/use-lang'
import { useNearViewport } from '@/lib/use-near-viewport'

// The placeholder reserves the final height (no layout shift, and the #footer
// hash target stays put) and reuses the 2001 loading line.
function Placeholder() {
  const t = DICT[useLang()].status
  return (
    <div className="min-h-[352px]">
      <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">{t.loading}</p>
    </div>
  )
}

// Code-split the dashboard out of the initial bundle — it fetches its own
// data on the client, so there is nothing to render on the server — and
// mounted only as the section nears the viewport (lib/use-near-viewport.ts).
const StatusDashboard = dynamic(() => import('./StatusDashboard'), { ssr: false, loading: Placeholder })

export default function LazyStatusDashboard() {
  const ref = useRef<HTMLDivElement>(null)
  const near = useNearViewport(ref)
  return <div ref={ref}>{near ? <StatusDashboard /> : <Placeholder />}</div>
}
