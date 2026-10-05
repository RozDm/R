import type { Metadata } from 'next'
import ContactPage from '@/components/contact/ContactPage'
import { pageMetadata } from '@/lib/metadata'

// A form page with no indexable content; keep it out of search results.
export const metadata: Metadata = pageMetadata({
  title: 'Kontakt',
  description: 'Send meg en melding — samarbeid, spørsmål eller bare et hei.',
  path: '/kontakt/',
  noindex: true,
})

export default function KontaktPage() {
  return <ContactPage lang="nb" />
}
