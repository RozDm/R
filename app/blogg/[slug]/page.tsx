import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ShareRow from '@/components/ShareRow'
import ViewCounter from '@/components/ViewCounter'
import { getPostBySlug, getPostSlugs, formatDate } from '@/lib/blog'
import { SITE_URL, AUTHOR } from '@/lib/site'

interface Props {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  let post
  try {
    post = getPostBySlug(slug)
  } catch {
    return {}
  }
  const url = `${SITE_URL}/blogg/${slug}/`
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      url,
      publishedTime: post.date,
      authors: [AUTHOR.name],
      tags: post.tags,
      locale: 'nb_NO',
    },
  }
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params
  let post
  try {
    post = getPostBySlug(slug)
  } catch {
    notFound()
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    image: `${SITE_URL}/blogg/${slug}/opengraph-image`,
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: 'nb-NO',
    keywords: post.tags.join(', '),
    mainEntityOfPage: `${SITE_URL}/blogg/${slug}/`,
    author: {
      '@type': 'Person',
      name: AUTHOR.name,
      jobTitle: AUTHOR.jobTitle,
      url: SITE_URL,
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Header />
      <main id="main" className="max-w-3xl mx-auto px-4 md:px-8 py-20">
        <Link
          href="/blogg"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          &larr; Tilbake til bloggen
        </Link>

        <article className="mt-8">
          <header className="mb-8">
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white leading-tight">
              {post.title}
            </h1>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-500">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              {' · '}
              {post.readingMinutes} min å lese
              <ViewCounter slug={slug} />
            </p>
          </header>

          <div className="prose dark:prose-invert max-w-none prose-a:text-red-500 dark:prose-a:text-red-400 prose-a:no-underline hover:prose-a:underline prose-headings:font-bold prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-gray-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
          </div>

          <ShareRow url={`${SITE_URL}/blogg/${slug}/`} title={post.title} />
        </article>
      </main>
      <Footer />
    </>
  )
}
