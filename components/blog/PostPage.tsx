import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ShareRow from './ShareRow'
import ViewCounter from './ViewCounter'
import { DICT } from '@/data/i18n'
import { formatDate, getAdjacentPosts, getPostBySlug, getPostSlugs, getTranslation, viewKey } from '@/lib/blog'
import { blogPath, postPath, tagPath } from '@/lib/blog-paths'
import { INTL_LOCALE, localePath, type Lang } from '@/lib/i18n'
import { pageMetadata } from '@/lib/metadata'
import { AUTHOR, SITE_URL } from '@/lib/site'
import { tagLabel } from '@/lib/tags'
import type { Post } from '@/types'

// A blog post, shared by /blogg/<slug>/ and /en/blog/<slug>/.

const other = (lang: Lang): Lang => (lang === 'nb' ? 'en' : 'nb')

export function postStaticParams(lang: Lang) {
  return getPostSlugs(lang).map((slug) => ({ slug }))
}

function load(lang: Lang, slug: string): Post | null {
  try {
    return getPostBySlug(slug, lang)
  } catch {
    return null
  }
}

// hreflang for a post with a twin in the other language.
function postLanguages(post: Post): Record<string, string> | undefined {
  const twin = getTranslation(post)
  if (!twin) return undefined
  const nbPath = postPath('nb', post.lang === 'nb' ? post.slug : twin.slug)
  const enPath = postPath('en', post.lang === 'en' ? post.slug : twin.slug)
  return { nb: nbPath, en: enPath, 'x-default': nbPath }
}

export function postMetadata(lang: Lang, slug: string): Metadata {
  const post = load(lang, slug)
  if (!post) return {}
  return pageMetadata({
    lang,
    title: post.title,
    description: post.description,
    path: postPath(lang, slug),
    ogTitle: post.title,
    ownImage: true,
    languages: postLanguages(post),
    article: {
      publishedTime: post.date,
      modifiedTime: post.updated && post.updated > post.date ? post.updated : undefined,
      tags: post.tags.map((tag) => tagLabel(tag, lang)),
    },
  })
}

export default function PostPage({ lang, slug }: { lang: Lang; slug: string }) {
  const post = load(lang, slug)
  if (!post) notFound()

  // Belt + braces: a draft can only reach this branch in dev (production
  // builds drop it from getPostSlugs and the static export never generates
  // its HTML). If something changes that invariant, 404 instead of
  // accidentally serving a draft.
  if (post.draft && process.env.NODE_ENV === 'production') notFound()
  const isDraft = post.draft === true
  const t = DICT[lang].blog

  const { prev, next } = getAdjacentPosts(slug, lang)
  const twin = getTranslation(post)
  const url = `${SITE_URL}${postPath(lang, slug)}`

  // Honest dateModified for SEO: the optional `updated` frontmatter wins;
  // otherwise it equals datePublished (Google accepts that — the field
  // signals "we have no later revision", not "the post was re-edited today").
  const updated = post.updated && post.updated > post.date ? post.updated : null
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    image: `${url}opengraph-image`,
    datePublished: post.date,
    dateModified: updated ?? post.date,
    inLanguage: INTL_LOCALE[lang],
    keywords: post.tags.map((tag) => tagLabel(tag, lang)).join(', '),
    mainEntityOfPage: url,
    ...(twin ? { workTranslation: { '@type': 'BlogPosting', url: `${SITE_URL}${postPath(other(lang), twin.slug)}`, inLanguage: INTL_LOCALE[other(lang)] } } : {}),
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
      { '@type': 'ListItem', position: 1, name: t.home, item: `${SITE_URL}${localePath(lang, '/')}` },
      { '@type': 'ListItem', position: 2, name: t.eyebrow, item: `${SITE_URL}${blogPath(lang)}` },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <Header lang={lang} alternate={twin ? postPath(other(lang), twin.slug) : blogPath(other(lang))} />
      <main id="main" className="max-w-3xl mx-auto px-4 md:px-8 py-20">
        <Link
          href={blogPath(lang)}
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          &larr; {t.back}
        </Link>

        <article className="mt-8">
          <header className="mb-8">
            {isDraft && (
              <p
                role="note"
                className="mb-4 inline-flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/5 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-red-600 dark:text-red-400"
              >
                <span aria-hidden>●</span>
                {t.draft}
              </p>
            )}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={tagPath(lang, tag)}
                    className="text-[11px] px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-500/40 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    {tagLabel(tag, lang)}
                  </Link>
                ))}
              </div>
            )}
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white leading-tight">
              {post.title}
            </h1>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              <time dateTime={post.date}>{formatDate(post.date, lang)}</time>
              {updated && (
                <>
                  {' · '}
                  <span className="text-gray-500 dark:text-gray-400">
                    {t.updated}{' '}
                    <time dateTime={updated}>{formatDate(updated, lang)}</time>
                  </span>
                </>
              )}
              {' · '}
              {t.read(post.readingMinutes)}
              <ViewCounter slug={viewKey(post)} />
            </p>
          </header>

          <div className="prose dark:prose-invert max-w-none prose-a:text-red-600 dark:prose-a:text-red-400 prose-a:underline prose-a:underline-offset-2 hover:prose-a:decoration-2 prose-headings:font-bold prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-gray-800 prose-pre:overflow-x-auto prose-pre:max-w-full prose-code:break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{post.content}</ReactMarkdown>
          </div>

          <ShareRow url={`${SITE_URL}${postPath(lang, slug)}`} lang={lang} />

          {(prev || next) && (
            <nav className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800 grid gap-4 sm:grid-cols-2">
              {prev ? (
                <Link
                  href={postPath(lang, prev.slug)}
                  className="group rounded-xl border border-gray-200 dark:border-gray-800 p-4 hover:border-red-500/30 dark:hover:border-red-500/20 transition-colors"
                >
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400">&larr; {t.prev}</span>
                  <span className="mt-1 block text-sm font-medium text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    {prev.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link
                  href={postPath(lang, next.slug)}
                  className="group rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-right hover:border-red-500/30 dark:hover:border-red-500/20 transition-colors sm:col-start-2"
                >
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{t.next} &rarr;</span>
                  <span className="mt-1 block text-sm font-medium text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    {next.title}
                  </span>
                </Link>
              )}
            </nav>
          )}
        </article>
      </main>
      <Footer lang={lang} />
    </>
  )
}
