// POST /api/contact — validate, Turnstile, rate-limit, store in D1, mail via
// Email Routing. Defence in depth: same-origin + bot-UA + honeypot + a burst
// cap (WRITE_LIMITER) + Turnstile (when configured) + per-IP and per-email
// rate limits.
import { EmailMessage } from 'cloudflare:email'
import { allowWrite, apiJson, readCapped } from '../http'
import { isWriteAllowed } from '../metrics'
import { clientKey } from '../ip'
import {
  CONTACT_ADDRESS,
  CONTACT_WINDOWS_MS,
  OWNER_INBOX,
  buildContactMime,
  isoCutoff,
  validateContact,
  verifyTurnstile,
} from '../contact'

const CONTACT_FROM = CONTACT_ADDRESS
const CONTACT_TO = OWNER_INBOX
// Max submissions per IP per 10 minutes (casual single-network abuse).
const CONTACT_IP_LIMIT = 3
// Max submissions per e-mail address per hour — spammers reuse a throwaway
// address while rotating IPs, so this catches what the IP gate misses.
const CONTACT_EMAIL_LIMIT = 2
// The largest body a real form sends is ~15 KB (5,000 characters of message
// at up to 3 UTF-8 bytes, a Turnstile token, the short fields). A larger
// Content-Length is refused before anything else; the body is read with the
// same cap either way (a client need not send the header).
export const CONTACT_MAX_BODY = 32_768

export async function handleContact(url: URL, request: Request, env: Env): Promise<Response | null> {
  if (url.pathname !== '/api/contact' || request.method !== 'POST') return null

  if (Number(request.headers.get('content-length')) > CONTACT_MAX_BODY) {
    return apiJson('{"error":"payload too large"}', 413)
  }

  if (!isWriteAllowed(request.headers, url.origin)) {
    return apiJson('{"error":"forbidden"}', 403)
  }

  const text = await readCapped(request, CONTACT_MAX_BODY)
  if (text === null) return apiJson('{"error":"payload too large"}', 413)
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return apiJson('{"error":"bad request"}', 400)
  }

  // Honeypot: bots fill every field; pretend success and drop it.
  if ((raw as { website?: unknown })?.website) {
    return apiJson('{"ok":true}')
  }

  const payload = validateContact(raw)
  if (!payload) return apiJson('{"error":"invalid"}', 422)

  // Burst cap per sender, independent of D1: the windows below are D1 counts,
  // which fail open when D1 errors (and a burst of parallel requests all read
  // the same count before any row lands). Ahead of Turnstile, so a flood
  // doesn't spend siteverify calls.
  if (!(await allowWrite(env, request, 'contact'))) return apiJson('{"error":"rate limited"}', 429)

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  // The per-IP window counts a whole IPv6 /64 as one sender (src/ip.ts) — and
  // that prefix, not the full address, is what the row keeps.
  const sender = clientKey(ip)

  // Turnstile is enforced only when the secret is set, so deploying the code
  // never breaks the form on its own — the dashboard setup activates it.
  if (env.TURNSTILE_SECRET) {
    if (!payload.turnstileToken) {
      return apiJson('{"error":"challenge required"}', 403)
    }
    // The widget ran on a page of this host (the form posts same-origin).
    const ok = await verifyTurnstile(payload.turnstileToken, env.TURNSTILE_SECRET, ip, url.hostname)
    if (!ok) return apiJson('{"error":"challenge failed"}', 403)
  }

  // Cutoffs are ISO strings like `at` itself — see CONTACT_WINDOWS_MS for
  // why comparing against SQLite's datetime('now', …) was wrong.
  const now = Date.now()
  const [recentByIp, recentByEmail] = await Promise.all([
    env.METRICS.prepare('SELECT COUNT(*) AS n FROM contact WHERE ip = ?1 AND at > ?2')
      .bind(sender, isoCutoff(now, CONTACT_WINDOWS_MS.perIp))
      .first<{ n: number }>()
      .catch(() => null),
    env.METRICS.prepare('SELECT COUNT(*) AS n FROM contact WHERE email = ?1 AND at > ?2')
      .bind(payload.email, isoCutoff(now, CONTACT_WINDOWS_MS.perEmail))
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
    'SELECT 1 AS n FROM contact WHERE email = ?1 AND message = ?2 AND at > ?3 LIMIT 1',
  )
    .bind(payload.email, payload.message, isoCutoff(now, CONTACT_WINDOWS_MS.duplicate))
    .first<{ n: number }>()
    .catch(() => null)
  if (duplicate) return apiJson('{"ok":true}')

  const at = new Date(now).toISOString()
  const row = await env.METRICS.prepare(
    'INSERT INTO contact (at, ip, name, email, message) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id',
  )
    .bind(at, sender, payload.name, payload.email, payload.message)
    .first<{ id: number }>()
    .catch((err) => {
      console.error('contact: D1 insert failed', err)
      return null
    })

  try {
    const mime = buildContactMime(CONTACT_FROM, CONTACT_TO, payload, at)
    await env.CONTACT_EMAIL.send(new EmailMessage(CONTACT_FROM, CONTACT_TO, mime))
  } catch (err) {
    // No address or message in the log line — the visitor's data stays out
    // of Workers Logs; the error itself is what needs noticing.
    console.error('contact: mail send failed', err)
    // Un-store the row: a stored-but-unsent row would make the visitor's retry
    // look like a duplicate (the dedup above would ack it with ok:true and never
    // mail it) and would eat into their rate limit. The form keeps its text on
    // an error, so nothing is lost by dropping the row — the retry re-stores it.
    if (row) {
      await env.METRICS.prepare('DELETE FROM contact WHERE id = ?1')
        .bind(row.id)
        .run()
        .catch(() => {})
    }
    return apiJson('{"error":"send failed"}', 502)
  }
  return apiJson('{"ok":true}')
}
