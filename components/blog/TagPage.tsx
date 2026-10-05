import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import PostCard from './PostCard'
import { DICT } from '@/data/i18n'
import { getAllTags, getPostsByTag } from '@/lib/blog'
import { blogPath, tagPath } from '@/lib/blog-paths'
import type { Lang } from '@/lib/i18n'
import { pageMetadata } from '@/lib/metadata'
import { tagLabel, tagToSlug } from '@/lib/tags'

// A topic page, shared by /blogg/tag/<slug>/ and /en/blog/tag/<slug>/. Tags
// are canonical across languages; the URL slug comes from the label shown in
// that language (Sikkerhet → /blogg/tag/sikkerhet/, /en/blog/tag/security/).

const other = (lang: Lang): Lang => (lang === 'nb' ? 'en' : 'nb')

export function tagStaticParams(lang: Lang) {
  return getAllTags(lang).map((tag) => ({ slug: tagToSlug(tagLabel(tag, lang)) }))
}

function resolveTag(lang: Lang, slug: string): string | null {
  return getAllTags(lang).find((tag) => tagToSlug(tagLabel(tag, lang)) === slug) ?? null
}

// The same topic in the other language, when it has posts there.
function twinPath(lang: Lang, tag: string): string | null {
  return getAllTags(other(lang)).includes(tag) ? tagPath(other(lang), tag) : null
}

export function tagMetadata(lang: Lang, slug: string): Metadata {
  const tag = resolveTag(lang, slug)
  if (!tag) return {}
  const t = DICT[lang].blog
  const label = tagLabel(tag, lang)
  const twin = twinPath(lang, tag)
  const nbPath = lang === 'nb' ? tagPath('nb', tag) : twin
  const enPath = lang === 'en' ? tagPath('en', tag) : twin
  return pageMetadata({
    lang,
    title: t.topicTitle(label),
    description: t.topicDescription(label),
    path: tagPath(lang, tag),
    languages: nbPath && enPath ? { nb: nbPath, en: enPath, 'x-default': nbPath } : undefined,
  })
}

export default function TagPage({ lang, slug }: { lang: Lang; slug: string }) {
  const tag = resolveTag(lang, slug)
  if (!tag) notFound()
  const t = DICT[lang].blog
  const posts = getPostsByTag(tag, lang)

  return (
    <>
      <Header lang={lang} alternate={twinPath(lang, tag) ?? blogPath(other(lang))} />
      <main id="main" className="max-w-3xl mx-auto px-4 md:px-8 py-20 min-h-[70vh]">
        <Link
          href={blogPath(lang)}
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors mb-8"
        >
          &larr; {t.back}
        </Link>

        <p className="text-red-600 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          {t.topic}
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">{tagLabel(tag, lang)}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">{t.count(posts.length)}</p>

        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      </main>
      <Footer lang={lang} />
    </>
  )
}
