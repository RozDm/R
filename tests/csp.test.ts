import { describe, expect, it } from 'vitest'
import { inlineScriptHashes, strictCsp } from '@/src/csp'

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
    expect(csp).toContain("script-src 'self' 'sha256-abc=' 'sha256-def=' https://static.cloudflareinsights.com")
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
