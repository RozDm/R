import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ShareRow from '@/components/blog/ShareRow'
import ViewCounter from '@/components/blog/ViewCounter'
import { getPostBySlug, getPostSlugs, getAdjacentPosts, formatDate } from '@/lib/blog'
import { tagToSlug } from '@/lib/tags'
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

  const { prev, next } = getAdjacentPosts(slug)

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

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Hjem', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Blogg', item: `${SITE_URL}/blogg/` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${SITE_URL}/blogg/${slug}/` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
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
                  <Link
                    key={tag}
                    href={`/blogg/tag/${tagToSlug(tag)}/`}
                    className="text-[11px] px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-500/40 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    {tag}
                  </Link>
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

          <div className="prose dark:prose-invert max-w-none prose-a:text-red-500 dark:prose-a:text-red-400 prose-a:no-underline hover:prose-a:underline prose-headings:font-bold prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-gray-800 prose-pre:overflow-x-auto prose-pre:max-w-full prose-code:break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{post.content}</ReactMarkdown>
          </div>

          <ShareRow url={`${SITE_URL}/blogg/${slug}/`} />

          {(prev || next) && (
            <nav className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800 grid gap-4 sm:grid-cols-2">
              {prev ? (
                <Link
                  href={`/blogg/${prev.slug}/`}
                  className="group rounded-xl border border-gray-200 dark:border-gray-800 p-4 hover:border-red-500/30 dark:hover:border-red-500/20 transition-colors"
                >
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500">&larr; Forrige</span>
                  <span className="mt-1 block text-sm font-medium text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    {prev.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link
                  href={`/blogg/${next.slug}/`}
                  className="group rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-right hover:border-red-500/30 dark:hover:border-red-500/20 transition-colors sm:col-start-2"
                >
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500">Neste &rarr;</span>
                  <span className="mt-1 block text-sm font-medium text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    {next.title}
                  </span>
                </Link>
              )}
            </nav>
          )}
        </article>
      </main>
      <Footer />
    </>
  )
}
