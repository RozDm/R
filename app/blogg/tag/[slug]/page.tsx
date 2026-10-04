import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import PostCard from '@/components/blog/PostCard'
import { getAllTags, getPostsByTag } from '@/lib/blog'
import { tagToSlug } from '@/lib/tags'
import { pageMetadata } from '@/lib/metadata'

interface Props {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return getAllTags().map((tag) => ({ slug: tagToSlug(tag) }))
}

function resolveTag(slug: string): string | null {
  return getAllTags().find((tag) => tagToSlug(tag) === slug) ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const tag = resolveTag(slug)
  if (!tag) return {}
  return pageMetadata({
    title: `Emne: ${tag}`,
    description: `Artikler merket med ${tag}.`,
    path: `/blogg/tag/${slug}/`,
  })
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params
  const tag = resolveTag(slug)
  if (!tag) notFound()

  const posts = getPostsByTag(tag)

  return (
    <>
      <Header />
      <main id="main" className="max-w-3xl mx-auto px-4 md:px-8 py-20 min-h-[70vh]">
        <Link
          href="/blogg"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors mb-8"
        >
          &larr; Tilbake til bloggen
        </Link>

        <p className="text-red-600 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          Emne
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
          {tag}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
          {posts.length} {posts.length === 1 ? 'artikkel' : 'artikler'}
        </p>

        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      </main>
      <Footer />
    </>
  )
}
