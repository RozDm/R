// Pure logic for outbound mail: contact-form validation/MIME and status-alert
// MIME. (DOM-compatible APIs only — tests import this under the app tsconfig.)

export const CONTACT_LIMITS = {
  name: 100,
  email: 200,
  message: 5000,
  messageMin: 10,
} as const

// Time windows over the contact table, applied as ISO cutoffs bound into SQL.
// `at` is stored as an ISO-8601 string ("2026-10-04T18:00:00.000Z") while
// SQLite's datetime('now', …) yields "2026-10-04 17:50:00". Compared as TEXT
// the 'T' sorts after the space, so EVERY row from the current UTC day read
// as "newer than 10 minutes": the 10-min / 1-h rate limits were really
// per-day caps, and the 2-minute duplicate check silently swallowed a
// same-day resend of the same message (ack'd, never mailed). ISO against ISO
// keeps the windows exact and the (ip, at) / (email, at) indexes usable.
export const CONTACT_WINDOWS_MS = {
  perIp: 10 * 60_000,
  perEmail: 60 * 60_000,
  duplicate: 2 * 60_000,
  retention: 30 * 86_400_000,
} as const

export function isoCutoff(nowMs: number, windowMs: number): string {
  return new Date(nowMs - windowMs).toISOString()
}

export interface ContactPayload {
  name: string
  email: string
  message: string
}

export interface ContactInput extends ContactPayload {
  turnstileToken: string | null
}

// Loose but practical: something@something.tld, no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateContact(input: unknown): ContactInput | null {
  if (typeof input !== 'object' || input === null) return null
  const { name, email, message, turnstileToken } = input as Record<string, unknown>
  if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') return null
  const n = name.trim()
  const e = email.trim()
  const m = message.trim()
  if (!n || n.length > CONTACT_LIMITS.name) return null
  if (!EMAIL_RE.test(e) || e.length > CONTACT_LIMITS.email) return null
  if (m.length < CONTACT_LIMITS.messageMin || m.length > CONTACT_LIMITS.message) return null
  return {
    name: n,
    email: e,
    message: m,
    turnstileToken: typeof turnstileToken === 'string' && turnstileToken.length > 0 ? turnstileToken : null,
  }
}

// Cloudflare Turnstile siteverify. Returns true on a valid token, false
// otherwise (or on transport failure — fail closed). The `remoteip` is the
// visitor's IP for the audit trail.
export async function verifyTurnstile(token: string, secret: string, remoteip?: string): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token })
  if (remoteip) body.set('remoteip', remoteip)
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    })
    if (!res.ok) return false
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

// RFC 2047 encoded-word so non-ASCII subjects survive SMTP.
export function encodeMimeHeader(text: string): string {
  if (/^[\x20-\x7e]*$/.test(text)) return text
  return `=?utf-8?B?${base64Utf8(text)}?=`
}

// Minimal raw MIME message: plain text, base64-encoded body so UTF-8 is safe.
export function buildContactMime(
  from: string,
  to: string,
  payload: ContactPayload,
  at: string,
): string {
  const subject = encodeMimeHeader(`Ny melding fra ${payload.name} (rozsoshnykh.no)`)
  const body = base64Utf8(
    `Navn: ${payload.name}\nE-post: ${payload.email}\nTidspunkt: ${at}\n\n${payload.message}\n`,
  )
  // 76-char lines per RFC 2045.
  const wrapped = body.replace(/(.{76})/g, '$1\r\n')
  return [
    `From: Kontaktskjema <${from}>`,
    `To: <${to}>`,
    `Reply-To: <${payload.email}>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapped,
  ].join('\r\n')
}

// Plain-text alert for an uptime-monitor state change. No Reply-To (no human
// on the other end), short fixed body so the inbox is greppable. Reuses the
// same base64 + RFC 2047 encoding as the contact mail so Email Routing handles
// the two identically.
export function buildStatusAlertMime(
  from: string,
  to: string,
  monitor: { name: string; url: string; ok: boolean; status: number; ms: number },
  at: string,
): string {
  const subject = encodeMimeHeader(
    monitor.ok ? `Status: ${monitor.name} er oppe igjen` : `Status: ${monitor.name} er nede`,
  )
  const body = base64Utf8(
    `Tjeneste: ${monitor.name}\nURL: ${monitor.url}\nTidspunkt: ${at}\nHTTP: ${monitor.status}\nLatens: ${monitor.ms} ms\nStatus: ${monitor.ok ? 'OK' : 'NEDE'}\n`,
  )
  const wrapped = body.replace(/(.{76})/g, '$1\r\n')
  return [
    `From: Status <${from}>`,
    `To: <${to}>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapped,
  ].join('\r\n')
}
