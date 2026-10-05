import type { Metadata } from 'next'
import TagPage, { tagMetadata, tagStaticParams } from '@/components/blog/TagPage'

interface Props {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return tagStaticParams('en')
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return tagMetadata('en', (await params).slug)
}

export default async function BlogTagEn({ params }: Props) {
  return <TagPage lang="en" slug={(await params).slug} />
}
