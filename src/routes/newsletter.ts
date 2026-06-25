// /api/newsletter — Phase 2 double-opt-in.
//
// POST /api/newsletter       — validate, rate-limit, insert (token), send
//                              confirmation e-mail via Resend.
// GET  /api/newsletter/confirm?token=...      — set confirmed_at.
// GET  /api/newsletter/unsubscribe?token=...  — delete row.
//
// Defence in depth on POST: same-origin + bot-UA + honeypot + per-IP rate
// limit. Mail dispatch is feature-gated on RESEND_API_KEY: deploying the code
// without the secret keeps Phase-1 behaviour (capture only, no e-mail), so the
// gate is the dashboard config, not the deploy.
//
// Confirm + unsubscribe are GETs so plain e-mail clients can navigate them
// without JS. Each redirects to /nyhetsbrev/<status>/ — bekreftet, avmeldt or
// ugyldig — so the user always lands on a themed page instead of a worker-
// rendered JSON body.
//
// CAVEAT (harden before enabling RESEND_API_KEY at volume): a GET that mutates
// D1 is auto-triggerable by mail link-scanners / prefetchers (SafeLinks, AV,
// chat unfurlers), which can pre-confirm a row without a human click (weak
// consent proof). The confirm mail intentionally carries no unsubscribe link
// (so a prefetch can't DELETE the row), but the robust pattern is a static
// landing page that reads ?token and POSTs the mutation behind a button — see
// the "Before enabling Resend" note in CLAUDE.md.
import { ENFORCED_CSP, HSTS, applyBaseHeaders } from '../csp'
import { apiJson } from '../http'
import { looksLikeBot } from '../metrics'
import {
  buildConfirmEmail,
  isValidConfirmToken,
  sendConfirmEmail,
  validateNewsletter,
} from '../newsletter'

const SITE_URL = 'https://rozsoshnykh.no'
const NEWSLETTER_FROM = 'Dmytro Rozsoshnykh <newsletter@rozsoshnykh.no>'

// Max sign-ups per IP per hour. Lower than the contact form — nobody
// legitimately signs up for the same newsletter many times in a row.
const NEWSLETTER_IP_LIMIT = 3

// 303 lands the email client on /nyhetsbrev/<status>/ via a fresh GET, no
// caching, no stale-on-back-button. Result pages are noindex so any crawler
// that follows the link doesn't pollute the index.
function redirectToResult(status: 'bekreftet' | 'avmeldt' | 'ugyldig'): Response {
  const response = new Response(null, {
    status: 303,
    headers: {
      Location: `${SITE_URL}/nyhetsbrev/${status}/`,
      'Cache-Control': 'no-store',
    },
  })
  applyBaseHeaders(response.headers)
  response.headers.set('Strict-Transport-Security', HSTS)
  response.headers.set('Content-Security-Policy', ENFORCED_CSP)
  return response
}

export async function handleNewsletter(
  url: URL,
  request: Request,
  env: Env,
): Promise<Response | null> {
  if (url.pathname !== '/api/newsletter' || request.method !== 'POST') return null

  if (
    request.headers.get('sec-fetch-site') !== 'same-origin' ||
    looksLikeBot(request.headers.get('user-agent'))
  ) {
    return apiJson('{"error":"forbidden"}', 403)
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return apiJson('{"error":"bad request"}', 400)
  }

  // Honeypot: bots fill every field; pretend success and drop it.
  if ((raw as { website?: unknown })?.website) {
    return apiJson('{"ok":true}')
  }

  const payload = validateNewsletter(raw)
  if (!payload) return apiJson('{"error":"invalid"}', 422)

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'

  const recent = await env.METRICS.prepare(
    "SELECT COUNT(*) AS n FROM subscribers WHERE ip = ?1 AND at > datetime('now', '-1 hour')",
  )
    .bind(ip)
    .first<{ n: number }>()
    .catch(() => null)
  if ((recent?.n ?? 0) >= NEWSLETTER_IP_LIMIT) return apiJson('{"error":"rate limited"}', 429)

  // Atomic insert: ON CONFLICT DO NOTHING means a repeat sign-up of the
  // same address is silently idempotent. The `changes()` count tells us
  // whether the row was actually inserted so the UI can show "you're
  // already subscribed" instead of a misleading "thanks!".
  const at = new Date().toISOString()
  const token = crypto.randomUUID()
  const result = await env.METRICS.prepare(
    'INSERT INTO subscribers (email, at, ip, token) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(email) DO NOTHING',
  )
    .bind(payload.email, at, ip, token)
    .run()
    .catch(() => null)
  const inserted = (result?.meta?.changes ?? 0) > 0

  // Send the confirmation e-mail only on a *fresh* insert and only when the
  // ESP secret is configured. Re-sending on a repeat sign-up of an unconfirmed
  // address would otherwise let an attacker spam an unrelated inbox once an
  // hour by replaying its address. The token returned to a repeat signer is
  // the original one, so they can ask for a resend out-of-band if needed.
  if (inserted && env.RESEND_API_KEY) {
    await sendConfirmEmail({
      apiKey: env.RESEND_API_KEY,
      from: NEWSLETTER_FROM,
      to: payload.email,
      email: buildConfirmEmail({ siteUrl: SITE_URL, token }),
    })
    // Best-effort: a Resend hiccup logs in observability but the row already
    // sits in D1; the UI still shows success so the user isn't told their
    // address is/isn't on the list (sender-failure leakage).
  }

  return apiJson(JSON.stringify({ ok: true, already: !inserted }))
}

export async function handleNewsletterConfirm(
  url: URL,
  request: Request,
  env: Env,
): Promise<Response | null> {
  if (url.pathname !== '/api/newsletter/confirm' || request.method !== 'GET') return null

  const token = url.searchParams.get('token')
  if (!isValidConfirmToken(token)) return redirectToResult('ugyldig')

  // Idempotent: re-clicking the link from an old e-mail doesn't move the
  // confirmation timestamp forward (COALESCE keeps the original), but still
  // resolves to "bekreftet". An unknown token resolves to "ugyldig".
  const at = new Date().toISOString()
  const result = await env.METRICS.prepare(
    'UPDATE subscribers SET confirmed_at = COALESCE(confirmed_at, ?1) WHERE token = ?2',
  )
    .bind(at, token)
    .run()
    .catch(() => null)
  if (!result || (result.meta?.changes ?? 0) === 0) return redirectToResult('ugyldig')
  return redirectToResult('bekreftet')
}

export async function handleNewsletterUnsubscribe(
  url: URL,
  request: Request,
  env: Env,
): Promise<Response | null> {
  if (url.pathname !== '/api/newsletter/unsubscribe' || request.method !== 'GET') return null

  const token = url.searchParams.get('token')
  if (!isValidConfirmToken(token)) return redirectToResult('ugyldig')

  // Delete outright — works whether the address was confirmed or not. A
  // repeated click on a stale link resolves to "ugyldig" (row already gone),
  // which reads correctly to the user.
  const result = await env.METRICS.prepare('DELETE FROM subscribers WHERE token = ?1')
    .bind(token)
    .run()
    .catch(() => null)
  if (!result || (result.meta?.changes ?? 0) === 0) return redirectToResult('ugyldig')
  return redirectToResult('avmeldt')
}
