// GET /.well-known/mta-sts.txt — the MTA-STS policy (RFC 8461) for mail to
// @rozsoshnykh.no. Sending servers fetch it from
// https://mta-sts.rozsoshnykh.no/ (a custom domain of this Worker) and then
// deliver only over TLS to the MX hosts it names.
//
// Cloudflare Email Routing runs our MX, so the policy is Cloudflare's: proxied
// from mta-sts.mx.cloudflare.net, whose TXT record our `_mta-sts` CNAME points
// at. When Cloudflare changes the policy it bumps that record's id, senders
// refetch, and get the new policy from here — no deploy, never a stale copy
// naming the wrong MX (that would bounce mail under `mode: enforce`).
import { ENFORCED_CSP, HSTS, applyBaseHeaders } from '../csp'

export const MTA_STS_PATH = '/.well-known/mta-sts.txt'
export const MTA_STS_UPSTREAM = 'https://mta-sts.mx.cloudflare.net/.well-known/mta-sts.txt'
const UPSTREAM_TIMEOUT_MS = 5_000
// Senders cache the policy for its own max_age; this only spares the upstream.
const CACHE_TTL_S = 3600

function policyResponse(body: string, status: number, cacheControl: string): Response {
  const response = new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': cacheControl },
  })
  applyBaseHeaders(response.headers)
  response.headers.set('Strict-Transport-Security', HSTS)
  response.headers.set('Content-Security-Policy', ENFORCED_CSP)
  return response
}

export async function handleMtaSts(url: URL): Promise<Response | null> {
  if (url.pathname !== MTA_STS_PATH) return null
  const upstream = await fetch(MTA_STS_UPSTREAM, {
    cf: { cacheTtl: CACHE_TTL_S, cacheEverything: true },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  }).catch(() => null)
  const body = upstream?.ok ? await upstream.text().catch(() => '') : ''
  // Never pass on something that isn't a policy (an error page, an empty
  // body): a sender would reject it, and an unreachable policy is the safer
  // failure — senders keep the copy they cached, or deliver as before.
  if (!body.startsWith('version: STSv1')) {
    console.error('mta-sts: upstream policy unavailable', upstream?.status ?? 'fetch failed')
    return policyResponse('policy unavailable\n', 503, 'no-store')
  }
  return policyResponse(body, 200, `public, max-age=${CACHE_TTL_S}`)
}
