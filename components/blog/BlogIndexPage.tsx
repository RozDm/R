import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import BlogList from './BlogList'
import { DICT } from '@/data/i18n'
import { getAllPosts, getAllTags } from '@/lib/blog'
import { blogPath } from '@/lib/blog-paths'
import { localePath, type Lang } from '@/lib/i18n'
import { pageMetadata } from '@/lib/metadata'

// The blog index, shared by /blogg/ and /en/blog/.
export function blogIndexMetadata(lang: Lang): Metadata {
  const t = DICT[lang].blog
  return pageMetadata({ lang, title: t.eyebrow, description: t.description, path: blogPath(lang) })
}

export default function BlogIndexPage({ lang }: { lang: Lang }) {
  const t = DICT[lang]
  return (
    <>
      <Header lang={lang} />
      <main id="main" className="max-w-3xl mx-auto px-4 md:px-8 py-20 min-h-[70vh]">
        <Link
          href={localePath(lang, '/')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors mb-8"
        >
          &larr; {t.backHome}
        </Link>

        <p className="text-red-600 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          {t.blog.eyebrow}
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-10">{t.blog.title}</h1>

        <BlogList posts={getAllPosts(lang)} tags={getAllTags(lang)} lang={lang} />
      </main>
      <Footer lang={lang} />
    </>
  )
}
