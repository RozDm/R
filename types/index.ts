export interface SkillGroup {
  title: string
  items: string[]
  learning?: boolean
}

export interface Certification {
  title: string
  issuer: string
}

export interface PostMeta {
  slug: string
  title: string
  description: string
  date: string
  // Optional ISO date of the last meaningful revision. When present and >
  // `date`, the post page shows "Oppdatert <date>" and feeds JSON-LD's
  // dateModified + RSS <atom:updated>. Absent → no badge, dateModified
  // falls back to `date`.
  updated?: string
  // True keeps the post out of every public surface (list, slug routing,
  // sitemap, RSS, tag pages) at build time. `npm run dev` still renders
  // drafts so the author has live preview; production builds drop them
  // before `generateStaticParams` runs, so the URL 404s.
  draft?: boolean
  tags: string[]
  readingMinutes: number
}

export interface Post extends PostMeta {
  content: string
}
