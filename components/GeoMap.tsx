'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface GeoData {
  countries: Record<string, number>
}

// ISO 3166-1 alpha-2 -> regional indicator emoji (🇳🇴 etc.)
function flag(code: string): string {
  return String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)))
}

// Intensity buckets keep the map readable regardless of absolute numbers.
function fillFor(count: number | undefined, isDark: boolean): string {
  if (!count) return isDark ? '#1f2937' : '#e5e7eb' // gray-800 / gray-200
  if (count < 3) return 'rgba(239, 68, 68, 0.30)'
  if (count < 10) return 'rgba(239, 68, 68, 0.55)'
  return 'rgba(239, 68, 68, 0.80)'
}

export default function GeoMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgReady, setSvgReady] = useState(false)
  const [data, setData] = useState<GeoData | null>(null)
  const [failed, setFailed] = useState(false)

  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames(['nb'], { type: 'region' })
    } catch {
      return null
    }
  }, [])
  const countryName = (code: string): string => {
    try {
      return regionNames?.of(code) ?? code
    } catch {
      return code
    }
  }

  // Fetch the pre-built /world.svg (cached + gzipped by Cloudflare) and inline
  // it into the DOM after hydration. ~84 kB of paths no longer ship in any JS
  // bundle, and the browser can stream the SVG in parallel with the rest.
  useEffect(() => {
    const controller = new AbortController()
    fetch('/world.svg', { signal: controller.signal })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('svg http ' + r.status))))
      .then((markup) => {
        if (!containerRef.current) return
        containerRef.current.innerHTML = markup
        const svg = containerRef.current.querySelector('svg')
        if (svg) {
          svg.setAttribute('role', 'img')
          svg.setAttribute('aria-label', 'Verdenskart over hvor besøkende kommer fra')
          svg.classList.add('w-full', 'h-auto', 'select-none')
          // Default stroke for the borders; per-path fill is set below.
          svg.querySelectorAll<SVGPathElement>('path').forEach((p) => {
            p.setAttribute('stroke-width', '1')
          })
        }
        setSvgReady(true)
      })
      .catch(() => setFailed(true))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/geo', { signal: controller.signal, cache: 'no-store' })
      .then((r) => r.json())
      .then((d: GeoData) => setData(d))
      .catch(() => {})
    return () => controller.abort()
  }, [])

  // Recolour paths whenever the data or SVG appears. CSS would do this in
  // pure CSS-vars if we could embed the per-country counts at build time, but
  // they come from the API at runtime — so we apply fills directly.
  useEffect(() => {
    if (!svgReady || !containerRef.current) return
    const isDark = document.documentElement.classList.contains('dark')
    const counts = data?.countries ?? {}
    const stroke = isDark ? '#030712' : '#ffffff'
    containerRef.current.querySelectorAll<SVGPathElement>('path').forEach((p) => {
      const code = p.id.replace(/^c-/, '')
      p.setAttribute('fill', fillFor(counts[code], isDark))
      p.setAttribute('stroke', stroke)
      // Title tooltip for hover.
      let title = p.querySelector<SVGTitleElement>('title')
      if (!title) {
        title = document.createElementNS('http://www.w3.org/2000/svg', 'title') as SVGTitleElement
        p.appendChild(title)
      }
      title.textContent = `${countryName(code)}${counts[code] ? ` · ${counts[code]} besøk` : ''}`
    })
  }, [svgReady, data, countryName])

  if (failed) return null

  const countries = data?.countries ?? {}
  const sorted = Object.entries(countries).sort((a, b) => b[1] - a[1])
  const total = sorted.reduce((sum, [, n]) => sum + n, 0)

  return (
    <div className="flex flex-col gap-5">
      {/* Reserved aspect-ratio box so the layout doesn't shift when the SVG
          finishes loading and the #footer anchor still lands correctly. */}
      <div
        ref={containerRef}
        className="w-full aspect-[2000/1001] flex items-center justify-center"
      >
        {!svgReady && (
          <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">Kalibrerer AE-35-enheten…</p>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">Ingen besøksdata ennå.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-mono text-gray-500 dark:text-gray-400">
          {sorted.map(([code, count]) => (
            <span key={code} className="inline-flex items-center gap-1.5">
              <span aria-hidden>{flag(code)}</span>
              {countryName(code)} <span className="text-gray-400 dark:text-gray-500">{count}</span>
            </span>
          ))}
          <span className="ml-auto text-gray-400 dark:text-gray-500">{total} sidevisninger</span>
        </div>
      )}
    </div>
  )
}
