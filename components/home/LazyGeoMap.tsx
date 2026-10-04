'use client'

import dynamic from 'next/dynamic'

// Code-split GeoMap out of the initial bundle: it sits below the fold, fetches
// its own data (and the ~96 kB world.svg) on mount, so there is nothing useful
// to render at build time. The fallback is the same box and line GeoMap shows
// while the SVG loads — same aspect ratio, so the chunk landing causes no
// layout shift on any screen width (a fixed min-height used to shrink on
// phones and grow on desktops), and no second loading message flashes by.
const GeoMap = dynamic(() => import('./GeoMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-[2000/1001] flex items-center justify-center">
      <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">Kalibrerer AE-35-enheten…</p>
    </div>
  ),
})

export default function LazyGeoMap() {
  return <GeoMap />
}
