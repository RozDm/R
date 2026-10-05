import type { Metadata } from 'next'
import PostPage, { postMetadata, postStaticParams } from '@/components/blog/PostPage'

interface Props {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return postStaticParams('en')
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return postMetadata('en', (await params).slug)
}

export default async function BlogPostEn({ params }: Props) {
  return <PostPage lang="en" slug={(await params).slug} />
}
