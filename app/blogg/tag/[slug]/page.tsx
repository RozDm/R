import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { getAllTags, getPostsByTag, formatDate } from '@/lib/blog'
import { tagToSlug } from '@/lib/tags'
import { SITE_URL } from '@/lib/site'

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
  return {
    title: `Emne: ${tag}`,
    description: `Artikler merket med ${tag}.`,
    alternates: { canonical: `${SITE_URL}/blogg/tag/${slug}/` },
  }
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
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors mb-8"
        >
          &larr; Tilbake til bloggen
        </Link>

        <p className="text-red-500 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
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
            <Link
              key={post.slug}
              href={`/blogg/${post.slug}/`}
              className="group block p-5 bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-red-500/30 dark:hover:border-red-500/20 transition-all duration-500"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                  {post.title}
                </h2>
                <span className="shrink-0 text-xs text-gray-500 dark:text-gray-500">
                  <time dateTime={post.date}>{formatDate(post.date)}</time>
                  {' · '}
                  {post.readingMinutes} min
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                {post.description}
              </p>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </>
  )
}
