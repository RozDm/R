import type { Metadata } from 'next'
import BlogIndexPage, { blogIndexMetadata } from '@/components/blog/BlogIndexPage'

export const metadata: Metadata = blogIndexMetadata('en')

export default function BlogIndexEn() {
  return <BlogIndexPage lang="en" />
}
