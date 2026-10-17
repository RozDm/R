import { describe, expect, it } from 'vitest'
import { CSP_REPORT_GROUP, CSP_REPORT_PATH, ENFORCED_CSP, HTML_FALLBACK_CSP, inlineScriptHashes, parseCspReports, strictCsp } from '@/src/csp'

describe('inlineScriptHashes', () => {
  it('hashes a single inline script', async () => {
    const html = '<html><body><script>console.log(1)</script></body></html>'
    const hashes = await inlineScriptHashes(html)
    expect(hashes).toHaveLength(1)
    expect(hashes[0]).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/)
  })

  it('ignores external scripts with src', async () => {
    const html = '<script src="/x.js"></script><script>inline</script>'
    const hashes = await inlineScriptHashes(html)
    expect(hashes).toHaveLength(1)
  })

  it('deduplicates identical scripts', async () => {
    const html = '<script>x</script><script>x</script>'
    const hashes = await inlineScriptHashes(html)
    expect(hashes).toHaveLength(1)
  })

  it('hashes JSON-LD scripts (type=application/ld+json)', async () => {
    const html = '<script type="application/ld+json">{"a":1}</script><script>y</script>'
    const hashes = await inlineScriptHashes(html)
    expect(hashes).toHaveLength(2)
  })

  it('returns empty array when no inline scripts present', async () => {
    const html = '<html><body><p>hi</p></body></html>'
    const hashes = await inlineScriptHashes(html)
    expect(hashes).toEqual([])
  })

  it('handles scripts with attributes', async () => {
    const html = '<script type="application/ld+json" id="x">{"a":1}</script>'
    const hashes = await inlineScriptHashes(html)
    expect(hashes).toHaveLength(1)
  })

  it('produces stable hashes for the same input', async () => {
    const html = '<script>const a = 1;</script>'
    const a = await inlineScriptHashes(html)
    const b = await inlineScriptHashes(html)
    expect(a).toEqual(b)
  })
})

describe('strictCsp', () => {
  it('embeds hashes in the script-src directive', () => {
    const csp = strictCsp(["'sha256-abc='", "'sha256-def='"])
    expect(csp).toContain("script-src 'self' 'sha256-abc=' 'sha256-def=' https://challenges.cloudflare.com;")
  })

  it('allows no Cloudflare Web Analytics host (removed; an edge-injected beacon must be refused)', () => {
    for (const csp of [strictCsp([]), ENFORCED_CSP, HTML_FALLBACK_CSP]) {
      expect(csp).not.toContain('cloudflareinsights')
    }
  })

  it('does not include unsafe-inline in script-src', () => {
    const csp = strictCsp(["'sha256-abc='"])
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src '))
    expect(scriptSrc).toBeDefined()
    expect(scriptSrc).not.toContain('unsafe-inline')
  })

  it('keeps frame-ancestors none and object-src none for A+ rating', () => {
    const csp = strictCsp([])
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
  })

  it('upgrades insecure subresource requests on real HTML pages', () => {
    const csp = strictCsp([])
    expect(csp).toContain('upgrade-insecure-requests')
  })
})

describe('strictCsp reporting', () => {
  it('asks browsers to report violations via both mechanisms', () => {
    const csp = strictCsp([])
    expect(csp).toContain(`report-uri ${CSP_REPORT_PATH}`)
    expect(csp).toContain(`report-to ${CSP_REPORT_GROUP}`)
  })
})

describe('parseCspReports', () => {
  const ORIGIN = 'https://rozsoshnykh.no'

  it('reads the legacy report-uri body', () => {
    const out = parseCspReports(
      {
        'csp-report': {
          'document-uri': 'https://rozsoshnykh.no/blogg/velkommen/?utm=x',
          'blocked-uri': 'https://evil.example/x.js?token=secret',
          'violated-directive': "script-src-elem 'self'",
        },
      },
      ORIGIN,
    )
    // Origin and path only — no query strings, no full URLs.
    expect(out).toEqual([{ directive: 'script-src-elem', blocked: 'https://evil.example', page: '/blogg/velkommen/' }])
  })

  it('reads a Reporting API batch and keeps keywords like inline', () => {
    const out = parseCspReports(
      [
        { type: 'csp-violation', body: { documentURL: `${ORIGIN}/`, blockedURL: 'inline', effectiveDirective: 'script-src-elem' } },
        { type: 'deprecation', body: { documentURL: `${ORIGIN}/` } },
      ],
      ORIGIN,
    )
    expect(out).toEqual([{ directive: 'script-src-elem', blocked: 'inline', page: '/' }])
  })

  it('drops browser-extension noise and reports about other origins', () => {
    const out = parseCspReports(
      [
        { type: 'csp-violation', body: { documentURL: `${ORIGIN}/`, blockedURL: 'chrome-extension://abc/inject.js', effectiveDirective: 'script-src' } },
        { type: 'csp-violation', body: { documentURL: 'https://other.example/', blockedURL: 'inline', effectiveDirective: 'script-src' } },
      ],
      ORIGIN,
    )
    expect(out).toEqual([])
  })

  it("drops Turnstile iframe violations — they are Cloudflare's, not ours", () => {
    // Seen live on /kontakt/ + /en/contact/: the widget iframe probes
    // fetch('data:,') under Cloudflare's own CSP, whose policy has no
    // report-uri/report-to, so browsers never send these here. Should one be
    // POSTed anyway, the own-origin check drops it.
    const frame =
      'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/oxo4a/0x4AAAAAADkVmlHmIw8pZ9b5/auto/fbE/new/normal'
    const out = parseCspReports(
      [
        {
          type: 'csp-violation',
          body: { documentURL: `${frame}?lang=auto`, blockedURL: 'data', effectiveDirective: 'connect-src', sourceFile: frame },
        },
      ],
      ORIGIN,
    )
    expect(out).toEqual([])
  })

  it('keeps a data: connect-src violation from our own document', () => {
    // Chromium's body for fetch('data:,…') blocked on our page: a real
    // problem (our connect-src has no data:), so it must still be logged.
    const out = parseCspReports(
      [
        {
          type: 'csp-violation',
          body: {
            documentURL: `${ORIGIN}/kontakt/`,
            blockedURL: 'data',
            effectiveDirective: 'connect-src',
            disposition: 'enforce',
            lineNumber: 2,
            columnNumber: 19,
            statusCode: 200,
            sample: '',
          },
        },
      ],
      ORIGIN,
    )
    expect(out).toEqual([{ directive: 'connect-src', blocked: 'data', page: '/kontakt/' }])
  })

  it('caps the batch and survives junk', () => {
    const one = { type: 'csp-violation', body: { documentURL: `${ORIGIN}/`, blockedURL: 'eval', effectiveDirective: 'script-src' } }
    expect(parseCspReports(Array(50).fill(one), ORIGIN)).toHaveLength(10)
    expect(parseCspReports(null, ORIGIN)).toEqual([])
    expect(parseCspReports('nope', ORIGIN)).toEqual([])
    expect(parseCspReports({ 'csp-report': { 'document-uri': 'not a url' } }, ORIGIN)).toEqual([])
  })
})
