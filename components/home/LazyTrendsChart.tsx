'use client'

import dynamic from 'next/dynamic'
import { DICT } from '@/data/i18n'
import { useLang } from '@/lib/use-lang'

// Code-split the Trends chart out of the initial bundle: it lives below the
// fold, fetches its own data, and the chart logic is the heavier client
// payload. The fallback reserves the card height to avoid layout shift.
const TrendsChart = dynamic(() => import('./TrendsChart'), {
  ssr: false,
  loading: function Loading() {
    const t = DICT[useLang()].trends
    return (
    <div className="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-5 md:p-6 min-h-[340px]">
      <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">{t.loading}</p>
    </div>
    )
  },
})

export default function LazyTrendsChart() {
  return <TrendsChart />
}
