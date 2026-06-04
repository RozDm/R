import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { getAllPosts, formatDate } from '@/lib/blog'
import { SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Blogg – Dmytro Rozsoshnykh',
  description: 'Artikler om systemadministrasjon, DevOps, infrastruktur, automatisering og sikkerhet.',
  alternates: { canonical: `${SITE_URL}/blogg/` },
  openGraph: {
    title: 'Blogg – Dmytro Rozsoshnykh',
    description: 'Artikler om systemadministrasjon, DevOps, infrastruktur og sikkerhet.',
    type: 'website',
    url: `${SITE_URL}/blogg/`,
    locale: 'nb_NO',
  },
}

export default function BloggIndex() {
  const posts = getAllPosts()

  return (
    <>
      <Header />
      <main id="main" className="max-w-3xl mx-auto px-4 md:px-8 py-20 min-h-[70vh]">
        <p className="text-red-500 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          Blogg
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-10">
          Artikler
        </h1>

        {posts.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Ingen artikler ennå.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blogg/${post.slug}`}
                className="group block p-5 bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-red-500/30 dark:hover:border-red-500/20 transition-all duration-500"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    {post.title}
                  </h2>
                  <time dateTime={post.date} className="shrink-0 text-xs text-gray-400 dark:text-gray-600">
                    {formatDate(post.date)}
                  </time>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  {post.description}
                </p>
                {post.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
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
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
