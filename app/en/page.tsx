import type { Metadata } from 'next'
import HomePage from '@/components/home/HomePage'
import { pageMetadata } from '@/lib/metadata'
import { SITE_COPY } from '@/lib/site'

export const metadata: Metadata = pageMetadata({
  lang: 'en',
  title: SITE_COPY.en.title,
  absoluteTitle: true,
  description: SITE_COPY.en.description,
  ogDescription: SITE_COPY.en.tagline,
  path: '/en/',
  ownImage: true,
})

export default function HomeEn() {
  return <HomePage lang="en" />
}
