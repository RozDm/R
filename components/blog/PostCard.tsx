import Link from 'next/link'
import { formatDate } from '@/lib/blog'
import { tagToSlug } from '@/lib/tags'
import type { PostMeta } from '@/types'

// One post in a list (/blogg and the tag pages). The whole card is clickable
// through a stretched title link (after:absolute inset-0) rather than an
// outer <a>, so the tag chips can be real links to their tag pages without
// nesting anchors.
export default function PostCard({ post }: { post: PostMeta }) {
  return (
    <article className="group relative p-5 bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-red-500/30 dark:hover:border-red-500/20 transition-all duration-500">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
          <Link href={`/blogg/${post.slug}/`} className="after:absolute after:inset-0 after:rounded-xl">
            {post.title}
          </Link>
        </h2>
        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          {' · '}
          {post.readingMinutes} min
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{post.description}</p>
      {post.tags.length > 0 && (
        <div className="relative z-10 mt-3 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <Link
              key={tag}
              href={`/blogg/tag/${tagToSlug(tag)}/`}
              className="text-[11px] px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-500/40 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              {tag}
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}
