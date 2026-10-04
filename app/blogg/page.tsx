import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import BlogList from '@/components/blog/BlogList'
import { getAllPosts, getAllTags } from '@/lib/blog'
import { pageMetadata } from '@/lib/metadata'

export const metadata: Metadata = pageMetadata({
  title: 'Blogg',
  description: 'Artikler om systemadministrasjon, DevOps, infrastruktur, automatisering og sikkerhet.',
  path: '/blogg/',
})

export default function BloggIndex() {
  const posts = getAllPosts()

  return (
    <>
      <Header />
      <main id="main" className="max-w-3xl mx-auto px-4 md:px-8 py-20 min-h-[70vh]">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors mb-8"
        >
          &larr; Tilbake til forsiden
        </Link>

        <p className="text-red-500 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          Blogg
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-10">
          Artikler
        </h1>

        <BlogList posts={posts} tags={getAllTags()} />
      </main>
      <Footer />
    </>
  )
}
