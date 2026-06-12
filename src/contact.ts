// Pure logic for the contact form: payload validation and MIME assembly.
// (DOM-compatible APIs only — tests import this under the app tsconfig.)

export const CONTACT_LIMITS = {
  name: 100,
  email: 200,
  message: 5000,
  messageMin: 10,
} as const

export interface ContactPayload {
  name: string
  email: string
  message: string
}

// Loose but practical: something@something.tld, no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateContact(input: unknown): ContactPayload | null {
  if (typeof input !== 'object' || input === null) return null
  const { name, email, message } = input as Record<string, unknown>
  if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') return null
  const n = name.trim()
  const e = email.trim()
  const m = message.trim()
  if (!n || n.length > CONTACT_LIMITS.name) return null
  if (!EMAIL_RE.test(e) || e.length > CONTACT_LIMITS.email) return null
  if (m.length < CONTACT_LIMITS.messageMin || m.length > CONTACT_LIMITS.message) return null
  return { name: n, email: e, message: m }
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
