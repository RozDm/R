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
  const svgRef = useRef<HTMLDivElement>(null)
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null)
  const [data, setData] = useState<GeoData | null>(null)
  const [failed, setFailed] = useState(false)

  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames(['nb'], { type: 'region' })
    } catch {
      return null
    }
  }, [])

  // Fetch the pre-built /world.svg (cached + gzipped by Cloudflare). The
  // markup is set via dangerouslySetInnerHTML below so React knows not to
  // reconcile the SVG contents — that's what crashed in production when we
  // touched innerHTML on a React-managed container.
  useEffect(() => {
    const controller = new AbortController()
    fetch('/world.svg', { signal: controller.signal })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('svg http ' + r.status))))
      .then((markup) => setSvgMarkup(markup))
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

  // Once the SVG is in the DOM, decorate it and recolour from the API data.
  // The effect depends only on what actually changes (markup + counts), not
  // on the country-name lookup function.
  const counts = data?.countries
  useEffect(() => {
    if (!svgMarkup || !svgRef.current) return
    const root = svgRef.current.querySelector('svg')
    if (!root) return
    root.setAttribute('role', 'img')
    root.setAttribute('aria-label', 'Verdenskart over hvor besøkende kommer fra')
    root.classList.add('w-full', 'h-auto', 'select-none')

    const isDark = document.documentElement.classList.contains('dark')
    const stroke = isDark ? '#030712' : '#ffffff'
    const names = regionNames
    const countryName = (code: string): string => {
      try {
        return names?.of(code) ?? code
      } catch {
        return code
      }
    }

    root.querySelectorAll<SVGPathElement>('path').forEach((p) => {
      const code = p.id.replace(/^c-/, '')
      const n = counts?.[code]
      p.setAttribute('fill', fillFor(n, isDark))
      p.setAttribute('stroke', stroke)
      p.setAttribute('stroke-width', '1')
      let title = p.querySelector<SVGTitleElement>('title')
      if (!title) {
        title = document.createElementNS('http://www.w3.org/2000/svg', 'title') as SVGTitleElement
        p.appendChild(title)
      }
      title.textContent = `${countryName(code)}${n ? ` · ${n} besøk` : ''}`
    })
  }, [svgMarkup, counts, regionNames])

  if (failed) return null

  const sorted = counts ? Object.entries(counts).sort((a, b) => b[1] - a[1]) : []
  const total = sorted.reduce((sum, [, n]) => sum + n, 0)
  const countryName = (code: string): string => {
    try {
      return regionNames?.of(code) ?? code
    } catch {
      return code
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Loading placeholder: a separate sibling so React never reconciles
          the SVG container below. */}
      {!svgMarkup && (
        <div className="w-full aspect-[2000/1001] flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">Kalibrerer AE-35-enheten…</p>
        </div>
      )}

      {/* Static container — once we set dangerouslySetInnerHTML, React keeps
          its hands off. We mutate fills/strokes through the ref above. */}
      {svgMarkup && (
        <div
          ref={svgRef}
          className="w-full aspect-[2000/1001]"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      )}

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
