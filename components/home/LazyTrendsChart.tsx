'use client'

import dynamic from 'next/dynamic'
import { useRef } from 'react'
import { DICT } from '@/data/i18n'
import { useLang } from '@/lib/use-lang'
import { useNearViewport } from '@/lib/use-near-viewport'

// Reserves the card's height, so neither the wait nor the chunk shifts the layout.
function Placeholder() {
  const t = DICT[useLang()].trends
  return (
    <div className="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-5 md:p-6 min-h-[340px]">
      <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">{t.loading}</p>
    </div>
  )
}

// Code-split the Trends chart out of the initial bundle (the heavier client
// payload) and mount it only as the section nears the viewport
// (lib/use-near-viewport.ts) — it fetches /api/timeseries and /api/geo.
const TrendsChart = dynamic(() => import('./TrendsChart'), { ssr: false, loading: Placeholder })

export default function LazyTrendsChart() {
  const ref = useRef<HTMLDivElement>(null)
  const near = useNearViewport(ref)
  return <div ref={ref}>{near ? <TrendsChart /> : <Placeholder />}</div>
}
