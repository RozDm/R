import type { Metadata } from 'next'
import BlogIndexPage, { blogIndexMetadata } from '@/components/blog/BlogIndexPage'

export const metadata: Metadata = blogIndexMetadata('nb')

export default function BloggIndex() {
  return <BlogIndexPage lang="nb" />
}
