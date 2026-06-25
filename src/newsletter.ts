// Pure helpers for the newsletter sign-up endpoint. DOM-compatible APIs
// only — tests import this under the app tsconfig.

export const NEWSLETTER_LIMITS = {
  email: 200,
} as const

export interface NewsletterPayload {
  email: string
  consent: boolean
  // Honeypot field — bots fill it, humans never see it. Kept on the payload
  // so the route can drop the submission silently.
  website: string
}

// Same email shape as the contact form: something@something.tld, no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateNewsletter(input: unknown): NewsletterPayload | null {
  if (typeof input !== 'object' || input === null) return null
  const { email, consent, website } = input as Record<string, unknown>
  if (typeof email !== 'string') return null
  // Explicit opt-in: GDPR consent has to be unticked-by-default and opt-in;
  // an absent or falsy flag fails the validation here, not in the UI alone.
  if (consent !== true) return null
  const e = email.trim().toLowerCase()
  if (!EMAIL_RE.test(e) || e.length > NEWSLETTER_LIMITS.email) return null
  return {
    email: e,
    consent: true,
    website: typeof website === 'string' ? website : '',
  }
}

// Tokens are generated with crypto.randomUUID() (122 bits, RFC 4122 v4). Loose
// format check before SQL — keeps oddball input out of D1; the actual security
// is in the unguessable token, not the regex.
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidConfirmToken(token: string | null): token is string {
  return typeof token === 'string' && TOKEN_RE.test(token)
}

export interface ConfirmEmail {
  subject: string
  text: string
  html: string
}

// Compose the double-opt-in e-mail. siteUrl is the absolute base (no trailing
// slash); token is the bearer that proves the recipient owns this address.
// Both links are absolute so they survive inbox preview / reading-pane proxies
// that rewrite relative refs. The "ikke meg" link doubles as a one-click
// unsubscribe so an accidentally-signed-up address can revoke without ever
// confirming.
export function buildConfirmEmail(opts: {
  siteUrl: string
  token: string
}): ConfirmEmail {
  const confirmUrl = `${opts.siteUrl}/api/newsletter/confirm?token=${opts.token}`
  const unsubscribeUrl = `${opts.siteUrl}/api/newsletter/unsubscribe?token=${opts.token}`
  const subject = 'Bekreft abonnementet på rozsoshnykh.no'
  const text =
    `Hei,\n\n` +
    `Takk for at du meldte deg på nyhetsbrevet til rozsoshnykh.no.\n` +
    `Bekreft adressen din ved å åpne lenken under:\n\n` +
    `${confirmUrl}\n\n` +
    `Var det ikke deg? Da kan du ignorere denne meldingen, eller fjerne\n` +
    `adressen direkte her:\n\n` +
    `${unsubscribeUrl}\n\n` +
    `— Dmytro\n`
  // Inline styles only — most webmail clients strip <style>/<link>. Layout is
  // table-free flow with safe defaults; the unsubscribe row is muted so it
  // doesn't look like the primary action but stays clickable.
  const html =
    `<!doctype html>` +
    `<html lang="nb"><head><meta charset="utf-8">` +
    `<title>Bekreft abonnementet</title></head>` +
    `<body style="margin:0;padding:24px;background:#0a0a0a;color:#e5e7eb;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;line-height:1.55">` +
    `<div style="max-width:520px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:12px;padding:28px">` +
    `<p style="margin:0 0 16px;color:#f87171;font-size:12px;letter-spacing:.16em;text-transform:uppercase">Nyhetsbrev</p>` +
    `<h1 style="margin:0 0 16px;font-size:20px;color:#ffffff">Bekreft abonnementet</h1>` +
    `<p style="margin:0 0 20px">Takk for at du meldte deg på nyhetsbrevet til rozsoshnykh.no. Bekreft adressen din ved å klikke på knappen under.</p>` +
    `<p style="margin:0 0 24px"><a href="${confirmUrl}" style="display:inline-block;padding:12px 20px;background:#ef4444;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600">Bekreft adressen</a></p>` +
    `<p style="margin:0 0 8px;font-size:13px;color:#9ca3af">Eller åpne denne lenken direkte:</p>` +
    `<p style="margin:0 0 24px;font-size:13px;color:#9ca3af;word-break:break-all"><a href="${confirmUrl}" style="color:#9ca3af">${confirmUrl}</a></p>` +
    `<hr style="border:none;border-top:1px solid #1f2937;margin:24px 0">` +
    `<p style="margin:0;font-size:12px;color:#6b7280">Var det ikke deg? Ignorér meldingen, eller <a href="${unsubscribeUrl}" style="color:#9ca3af">fjern adressen</a> nå.</p>` +
    `</div></body></html>`
  return { subject, text, html }
}

// Resend Emails API call. Returns true on 2xx, false otherwise (incl. transport
// failure — fail closed, the route still reports success to the user so a
// configured-but-misbehaving ESP doesn't reveal whether an address is on the
// list). Failures land in Worker observability so a silently-broken sender is
// diagnosable from the dashboard.
export async function sendConfirmEmail(opts: {
  apiKey: string
  from: string
  to: string
  email: ConfirmEmail
}): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: opts.from,
        to: opts.to,
        subject: opts.email.subject,
        text: opts.email.text,
        html: opts.email.html,
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('newsletter: Resend returned', res.status, text.slice(0, 200))
      return false
    }
    return true
  } catch (err) {
    console.error('newsletter: Resend fetch failed', err)
    return false
  }
}
