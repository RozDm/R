import Link from 'next/link'
import PostCard from './PostCard'
import { tagPath } from '@/lib/blog-paths'
import { tagLabel } from '@/lib/tags'
import type { Lang } from '@/lib/i18n'
import { DICT } from '@/data/i18n'
import type { PostMeta } from '@/types'

// The blog index list (/blogg/, /en/blog/). A server component: the topic chips link to the static
// tag pages (…/tag/<slug>/) instead of filtering client-side, so there
// is one way to browse by topic, it works without JS, and the list ships no
// component code. Newest first (getAllPosts already sorts).
export default function BlogList({ posts, tags, lang }: { posts: PostMeta[]; tags: string[]; lang: Lang }) {
  const t = DICT[lang].blog
  if (posts.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">{t.empty}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {tags.length > 0 && (
        <nav aria-label={t.topics} className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-mono uppercase tracking-widest text-gray-500 dark:text-gray-400 mr-1">
            {t.topics}
          </span>
          {tags.map((tag) => {
            const count = posts.filter((p) => p.tags.includes(tag)).length
            return (
              <Link
                key={tag}
                href={tagPath(lang, tag)}
                className="text-[11px] px-2.5 py-1 rounded-md border font-mono border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-500/40 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                {tagLabel(tag, lang)} <span>({count})</span>
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
