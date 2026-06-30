'use client'

import dynamic from 'next/dynamic'

// Code-split GeoMap out of the initial bundle: it sits below the fold, fetches
// its own data (and a ~250 kB world.svg) on mount, so there is nothing useful
// to render at build time. The fallback reserves a reasonable height to avoid
// a layout shift when the SVG arrives.
const GeoMap = dynamic(() => import('./GeoMap'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[420px] geo-map">
      <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">Tegner kartet…</p>
    </div>
  ),
})

export default function LazyGeoMap() {
  return <GeoMap />
}
