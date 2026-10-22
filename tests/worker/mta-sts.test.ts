import { afterEach, describe, expect, it, vi } from 'vitest'
import { MTA_STS_PATH, MTA_STS_UPSTREAM, handleMtaSts } from '../../src/routes/mta-sts'

const POLICY = 'version: STSv1\nmode: enforce\nmx: *.mx.cloudflare.net\nmax_age: 86400\n'
const url = new URL(`https://mta-sts.rozsoshnykh.no${MTA_STS_PATH}`)

describe('/.well-known/mta-sts.txt', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('passes on Cloudflare’s policy as text/plain', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(POLICY))
    vi.stubGlobal('fetch', fetchMock)
    const res = (await handleMtaSts(url))!
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(res.headers.get('strict-transport-security')).toContain('max-age=')
    expect(await res.text()).toBe(POLICY)
    expect(fetchMock.mock.calls[0][0]).toBe(MTA_STS_UPSTREAM)
  })

  it('answers 503 rather than pass on an error page or a dead upstream', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const upstream of [
      async () => new Response('<html>error</html>', { status: 200 }),
      async () => new Response('nope', { status: 502 }),
      async () => {
        throw new Error('network')
      },
    ]) {
      vi.stubGlobal('fetch', vi.fn(upstream))
      const res = (await handleMtaSts(url))!
      expect(res.status).toBe(503)
      expect(res.headers.get('cache-control')).toBe('no-store')
    }
    error.mockRestore()
  })

  it('leaves every other path alone', async () => {
    expect(await handleMtaSts(new URL('https://mta-sts.rozsoshnykh.no/'))).toBeNull()
    expect(await handleMtaSts(new URL('https://rozsoshnykh.no/.well-known/security.txt'))).toBeNull()
  })
})
