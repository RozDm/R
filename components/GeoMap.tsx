'use client'

import { useEffect, useMemo, useState } from 'react'

interface CountryShape {
  id: string
  shape: string
}

interface GeoData {
  countries: Record<string, number>
}

// ISO 3166-1 alpha-2 -> regional indicator emoji (🇳🇴 etc.)
function flag(code: string): string {
  return String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)))
}

// Intensity buckets keep the map readable regardless of absolute numbers.
function fillFor(count: number | undefined): string {
  if (!count) return 'fill-gray-200 dark:fill-gray-800'
  if (count < 3) return 'fill-red-500/30'
  if (count < 10) return 'fill-red-500/55'
  return 'fill-red-500/80'
}

export default function GeoMap() {
  const [shapes, setShapes] = useState<CountryShape[] | null>(null)
  const [data, setData] = useState<GeoData | null>(null)
  const [failed, setFailed] = useState(false)

  // Full Norwegian country names from the ISO code, built into the browser —
  // no dependency, falls back to the code itself if the API is missing.
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

  // The map paths are ~85 kB — load them lazily after hydration so they
  // never weigh down the first paint of the front page.
  useEffect(() => {
    let cancelled = false
    import('world-map-country-shapes')
      .then((m) => {
        if (!cancelled) setShapes((m.default ?? m) as unknown as CountryShape[])
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/geo', { signal: controller.signal, cache: 'no-store' })
      .then((r) => r.json())
      .then((d: GeoData) => setData(d))
      .catch(() => {})
    return () => controller.abort()
  }, [])

  if (failed) return null
  // Reserve the final footprint while the 85 kB of map paths load: the SVG
  // is 2000x1001, the legend line below is ~28px. Keeps the #footer anchor
  // from shifting when the chunk arrives.
  if (!shapes) {
    return (
      <div className="flex flex-col gap-5">
        <div className="w-full aspect-[2000/1001] flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">Kalibrerer AE-35-enheten…</p>
        </div>
        <p className="text-xs font-mono text-transparent select-none" aria-hidden>
          —
        </p>
      </div>
    )
  }

  const countries = data?.countries ?? {}
  const sorted = Object.entries(countries).sort((a, b) => b[1] - a[1])
  const total = sorted.reduce((sum, [, n]) => sum + n, 0)

  return (
    <div className="flex flex-col gap-5">
      <svg
        viewBox="0 0 2000 1001"
        role="img"
        aria-label="Verdenskart over hvor besøkende kommer fra"
        className="w-full h-auto select-none"
      >
        {shapes.map((c) => (
          <path
            key={c.id}
            d={c.shape}
            className={`${fillFor(countries[c.id])} stroke-white dark:stroke-gray-950 transition-colors duration-500`}
            strokeWidth="1"
          >
            <title>{`${countryName(c.id)}${countries[c.id] ? ` · ${countries[c.id]} besøk` : ''}`}</title>
          </path>
        ))}
      </svg>

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
