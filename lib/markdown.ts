import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeHighlight from 'rehype-highlight'
import rehypeStringify from 'rehype-stringify'

// Render a markdown string to an HTML string (server-side, build-time). Same
// gfm + syntax-highlighting pipeline as the on-page ReactMarkdown render, used
// for RSS <content:encoded> so readers get the full post.
export async function markdownToHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(markdown)
  return String(file)
}
