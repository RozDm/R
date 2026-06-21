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
