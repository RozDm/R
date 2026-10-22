import { describe, expect, it } from 'vitest'
import { fontPreloads, withFontPreload } from '../scripts/finalize-export.mjs'

const FONT = '<link rel="preload" href="/_next/static/media/abc.p.woff2" as="font" crossorigin="" type="font/woff2"/>'
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1"/>'

describe('finalize-export font preload', () => {
  it('finds the body font preload Next emits', () => {
    expect(fontPreloads(`<head>${VIEWPORT}${FONT}</head>`)).toEqual([FONT])
    expect(fontPreloads('<head><link rel="preload" as="script" href="/a.js"/></head>')).toEqual([])
  })

  // Next leaves it off the 404; with display: 'optional' that page then
  // renders in the system monospace.
  it('adds it after the viewport meta of a page that lacks it', () => {
    const html = `<head><meta charSet="utf-8"/>${VIEWPORT}<title>404</title></head>`
    expect(withFontPreload(html, [FONT])).toBe(`<head><meta charSet="utf-8"/>${VIEWPORT}${FONT}<title>404</title></head>`)
  })

  it('leaves a page that has it alone, and falls back to </head>', () => {
    const has = `<head>${VIEWPORT}${FONT}</head>`
    expect(withFontPreload(has, [FONT])).toBe(has)
    expect(withFontPreload('<head><title>x</title></head>', [FONT])).toBe(`<head><title>x</title>${FONT}</head>`)
  })
})
