import Link from 'next/link'
import PostCard from './PostCard'
import { tagToSlug } from '@/lib/tags'
import type { PostMeta } from '@/types'

// The /blogg list. A server component: the topic chips link to the static
// tag pages (/blogg/tag/<slug>/) instead of filtering client-side, so there
// is one way to browse by topic, it works without JS, and the list ships no
// component code. Newest first (getAllPosts already sorts).
export default function BlogList({ posts, tags }: { posts: PostMeta[]; tags: string[] }) {
  if (posts.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">Ingen artikler ennå.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {tags.length > 0 && (
        <nav aria-label="Emner" className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-mono uppercase tracking-widest text-gray-500 dark:text-gray-400 mr-1">
            Emner
          </span>
          {tags.map((tag) => {
            const count = posts.filter((p) => p.tags.includes(tag)).length
            return (
              <Link
                key={tag}
                href={`/blogg/tag/${tagToSlug(tag)}/`}
                className="text-[11px] px-2.5 py-1 rounded-md border font-mono border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-500/40 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                {tag} <span className="opacity-60">({count})</span>
              </Link>
            )
          })}
        </nav>
      )}

      <div className="flex flex-col gap-4">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  )
}
