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
  tags: string[]
  readingMinutes: number
}

export interface Post extends PostMeta {
  content: string
}
