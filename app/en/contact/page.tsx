import type { Metadata } from 'next'
import ContactPage from '@/components/contact/ContactPage'
import { pageMetadata } from '@/lib/metadata'

// Like /kontakt/: a form page, kept out of search results.
export const metadata: Metadata = pageMetadata({
  lang: 'en',
  title: 'Contact',
  description: 'Send me a message — collaboration, questions or just a hello.',
  path: '/en/contact/',
  noindex: true,
})

export default function ContactPageEn() {
  return <ContactPage lang="en" />
}
