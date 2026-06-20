// POST /api/newsletter — Phase 1: capture only. Validates the email,
// records it with a consent proof (IP + timestamp) and a token that will
// double as the unsubscribe / double-opt-in key once the sending side
// lands. No confirmation e-mail is dispatched yet — the row sits with
// confirmed_at = NULL and waits for Phase 2.
//
// Defence in depth mirrors /api/contact: same-origin + bot-UA + honeypot +
// Turnstile (when configured) + per-IP rate limit.
import { apiJson } from '../http'
import { looksLikeBot } from '../metrics'
import { validateNewsletter } from '../newsletter'
import { verifyTurnstile } from '../contact'

// Max sign-ups per IP per hour. Lower than the contact form — nobody
// legitimately signs up for the same newsletter many times in a row.
const NEWSLETTER_IP_LIMIT = 3

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

  if (env.TURNSTILE_SECRET) {
    if (!payload.turnstileToken) {
      return apiJson('{"error":"challenge required"}', 403)
    }
    const ok = await verifyTurnstile(payload.turnstileToken, env.TURNSTILE_SECRET, ip)
    if (!ok) return apiJson('{"error":"challenge failed"}', 403)
  }

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
  return apiJson(JSON.stringify({ ok: true, already: !inserted }))
}
