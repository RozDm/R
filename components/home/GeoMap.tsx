'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchGeoCountries, geoBucket } from '@/lib/geo'
import { DICT } from '@/data/i18n'
import { INTL_LOCALE } from '@/lib/i18n'
import { useLang } from '@/lib/use-lang'

interface GeoData {
  countries: Record<string, number>
}

// Swatches for the legend — the same fills as `.geo-map path[data-v]` in
// app/globals.css, low → high.
const LEGEND_FILLS = ['rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0.55)', 'rgba(239, 68, 68, 0.8)']

// ISO 3166-1 alpha-2 -> regional indicator emoji (🇳🇴 etc.)
function flag(code: string): string {
  return String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)))
}

export default function GeoMap() {
  const lang = useLang()
  const t = DICT[lang].visitors
  const svgRef = useRef<HTMLDivElement>(null)
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null)
  const [data, setData] = useState<GeoData | null>(null)
  // The map outline (world.svg) and the counts (/api/geo) fail separately:
  // no outline still leaves a useful country list, no counts gets a message.
  const [svgFailed, setSvgFailed] = useState(false)
  const [dataFailed, setDataFailed] = useState(false)

  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([INTL_LOCALE[lang]], { type: 'region' })
    } catch {
      return null
    }
  }, [lang])

  // Fetch the pre-built /world.svg (browser-cached for a week). The
  // markup is set via dangerouslySetInnerHTML below so React knows not to
  // reconcile the SVG contents — that's what crashed in production when we
  // touched innerHTML on a React-managed container.
  useEffect(() => {
    const controller = new AbortController()
    fetch('/world.svg', { signal: controller.signal })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('svg http ' + r.status))))
      .then((markup) => setSvgMarkup(markup))
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setSvgFailed(true)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    let cancelled = false
    // Shared with the Trends card's all-time total (lib/geo.ts) — one request.
    fetchGeoCountries()
      .then((countries) => {
        if (!cancelled) setData({ countries })
      })
      // Say it failed rather than showing "Ingen besøksdata ennå", which read
      // as the data being gone.
      .catch(() => {
        if (!cancelled) setDataFailed(true)
      })
    return () => {
      cancelled = true
    }
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
    root.setAttribute('aria-label', t.mapLabel)
    root.classList.add('w-full', 'h-auto', 'select-none')

    const names = regionNames
    const countryName = (code: string): string => {
      try {
        return names?.of(code) ?? code
      } catch {
        return code
      }
    }

    const max = Math.max(0, ...Object.values(counts ?? {}))
    root.querySelectorAll<SVGPathElement>('path').forEach((p) => {
      const code = p.id.replace(/^c-/, '')
      const n = counts?.[code]
      // Fill/stroke come from CSS; only the data-driven intensity is set here.
      const bucket = geoBucket(n, max)
      if (bucket) p.setAttribute('data-v', bucket)
      else p.removeAttribute('data-v')
      let title = p.querySelector<SVGTitleElement>('title')
      if (!title) {
        title = document.createElementNS('http://www.w3.org/2000/svg', 'title') as SVGTitleElement
        p.appendChild(title)
      }
      title.textContent = `${countryName(code)}${n ? ` · ${t.visits(n)}` : ''}`
    })
  }, [svgMarkup, counts, regionNames, t])

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
      {!svgMarkup && !svgFailed && (
        <div className="w-full aspect-[2000/1001] flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">{t.loading}</p>
        </div>
      )}

      {/* Static container — once we set dangerouslySetInnerHTML, React keeps
          its hands off. We mutate fills/strokes through the ref above. */}
      {svgMarkup && (
        <div
          ref={svgRef}
          className="geo-map w-full aspect-[2000/1001]"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      )}

      {dataFailed ? (
        <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">{t.failed}</p>
      ) : data === null ? (
        // Still loading: a same-height placeholder, NOT the empty-state text —
        // flashing "Ingen besøksdata ennå" on every refresh read as data loss.
        <p aria-hidden className="text-gray-500 dark:text-gray-400 font-mono text-sm">…</p>
      ) : sorted.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">{t.empty}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-mono text-gray-500 dark:text-gray-400">
          {sorted.map(([code, count]) => (
            <span key={code} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="font-flag">{flag(code)}</span>
              {countryName(code)} <span className="text-gray-500 dark:text-gray-400">{count}</span>
            </span>
          ))}
          <span className="ml-auto inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1" aria-hidden>
              {t.fewer}
              {LEGEND_FILLS.map((fill) => (
                <span key={fill} className="inline-block w-3 h-3 rounded-sm" style={{ background: fill }} />
              ))}
              {t.more}
            </span>
            <span>{t.visits(total)}</span>
          </span>
        </div>
      )}
    </div>
  )
}
