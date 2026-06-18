// POST /api/contact — validate, Turnstile, rate-limit, store in D1, mail via
// Email Routing. Defence in depth: same-origin + bot-UA + honeypot + Turnstile
// (when configured) + per-IP and per-email rate limits.
import { EmailMessage } from 'cloudflare:email'
import { apiJson } from '../http'
import { looksLikeBot } from '../metrics'
import { buildContactMime, validateContact, verifyTurnstile } from '../contact'

const CONTACT_FROM = 'contact@rozsoshnykh.no'
const CONTACT_TO = 'd.rossoshnyh@gmail.com'
// Max submissions per IP per 10 minutes (casual single-network abuse).
const CONTACT_IP_LIMIT = 3
// Max submissions per e-mail address per hour — spammers reuse a throwaway
// address while rotating IPs, so this catches what the IP gate misses.
const CONTACT_EMAIL_LIMIT = 2

export async function handleContact(url: URL, request: Request, env: Env): Promise<Response | null> {
  if (url.pathname !== '/api/contact' || request.method !== 'POST') return null

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

  const payload = validateContact(raw)
  if (!payload) return apiJson('{"error":"invalid"}', 422)

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'

  // Turnstile is enforced only when the secret is set, so deploying the code
  // never breaks the form on its own — the dashboard setup activates it.
  if (env.TURNSTILE_SECRET) {
    if (!payload.turnstileToken) {
      return apiJson('{"error":"challenge required"}', 403)
    }
    const ok = await verifyTurnstile(payload.turnstileToken, env.TURNSTILE_SECRET, ip)
    if (!ok) return apiJson('{"error":"challenge failed"}', 403)
  }

  const [recentByIp, recentByEmail] = await Promise.all([
    env.METRICS.prepare(
      "SELECT COUNT(*) AS n FROM contact WHERE ip = ?1 AND at > datetime('now', '-10 minutes')",
    )
      .bind(ip)
      .first<{ n: number }>()
      .catch(() => null),
    env.METRICS.prepare(
      "SELECT COUNT(*) AS n FROM contact WHERE email = ?1 AND at > datetime('now', '-1 hour')",
    )
      .bind(payload.email)
      .first<{ n: number }>()
      .catch(() => null),
  ])
  if ((recentByIp?.n ?? 0) >= CONTACT_IP_LIMIT) return apiJson('{"error":"rate limited"}', 429)
  if ((recentByEmail?.n ?? 0) >= CONTACT_EMAIL_LIMIT) return apiJson('{"error":"rate limited"}', 429)

  // Idempotency: a double-submit (double-click, lost response + retry, browser
  // resend) would otherwise store a second row and send a second e-mail. Treat
  // an identical message from the same address within a short window as the
  // same submission and ack it without re-sending. Keyed on content rather
  // than a client token so it needs no schema change and survives a client
  // that forgets to send a key.
  const duplicate = await env.METRICS.prepare(
    "SELECT 1 AS n FROM contact WHERE email = ?1 AND message = ?2 AND at > datetime('now', '-2 minutes') LIMIT 1",
  )
    .bind(payload.email, payload.message)
    .first<{ n: number }>()
    .catch(() => null)
  if (duplicate) return apiJson('{"ok":true}')

  const at = new Date().toISOString()
  await env.METRICS.prepare(
    'INSERT INTO contact (at, ip, name, email, message) VALUES (?1, ?2, ?3, ?4, ?5)',
  )
    .bind(at, ip, payload.name, payload.email, payload.message)
    .run()
    .catch(() => {})

  try {
    const mime = buildContactMime(CONTACT_FROM, CONTACT_TO, payload, at)
    await env.CONTACT_EMAIL.send(new EmailMessage(CONTACT_FROM, CONTACT_TO, mime))
  } catch {
    // The submission is already in D1; surface a soft error.
    return apiJson('{"error":"send failed"}', 502)
  }
  return apiJson('{"ok":true}')
}
