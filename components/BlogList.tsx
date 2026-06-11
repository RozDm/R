'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

interface ListedPost {
  slug: string
  title: string
  description: string
  date: string
  dateFormatted: string
  tags: string[]
  readingMinutes: number
}

type SortOrder = 'newest' | 'oldest'

export default function BlogList({ posts }: { posts: ListedPost[] }) {
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')

  const allTags = useMemo(
    () => Array.from(new Set(posts.flatMap((p) => p.tags))).sort(),
    [posts],
  )

  const visible = useMemo(() => {
    const filtered = activeTag ? posts.filter((p) => p.tags.includes(activeTag)) : posts
    return [...filtered].sort((a, b) =>
      sortOrder === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
    )
  }, [posts, activeTag, sortOrder])

  if (posts.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">Ingen artikler ennå.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer artikler etter tag">
          <button
            onClick={() => setActiveTag(null)}
            aria-pressed={activeTag === null}
            className={`text-[11px] px-2.5 py-1 rounded-md border font-mono transition-colors ${
              activeTag === null
                ? 'border-red-500/40 text-red-500 dark:text-red-400 bg-red-500/5'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-500/40 hover:text-red-500 dark:hover:text-red-400'
            }`}
          >
            Alle ({posts.length})
          </button>
          {allTags.map((tag) => {
            const count = posts.filter((p) => p.tags.includes(tag)).length
            const active = activeTag === tag
            return (
              <button
                key={tag}
                onClick={() => setActiveTag(active ? null : tag)}
                aria-pressed={active}
                className={`text-[11px] px-2.5 py-1 rounded-md border font-mono transition-colors ${
                  active
                    ? 'border-red-500/40 text-red-500 dark:text-red-400 bg-red-500/5'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-500/40 hover:text-red-500 dark:hover:text-red-400'
                }`}
              >
                {tag} <span className="opacity-50">({count})</span>
              </button>
            )
          })}
        </div>

        <button
          onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
          aria-label={`Sortér etter dato, nå: ${sortOrder === 'newest' ? 'nyeste først' : 'eldste først'}`}
          className="shrink-0 self-start inline-flex items-center gap-1.5 text-xs font-mono text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          {sortOrder === 'newest' ? 'Nyeste først' : 'Eldste først'}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`transition-transform duration-300 ${sortOrder === 'oldest' ? 'rotate-180' : ''}`}
          >
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Ingen artikler matcher dette filteret.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((post) => (
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
                  <time dateTime={post.date}>{post.dateFormatted}</time>
                  {' · '}
                  {post.readingMinutes} min
                </span>
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
    </div>
  )
}
