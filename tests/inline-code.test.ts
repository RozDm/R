import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { MAX_NOWRAP_WORD, rehypeInlineCode } from '@/lib/inline-code'

const render = async (md: string) =>
  String(await unified().use(remarkParse).use(remarkRehype).use(rehypeInlineCode).use(rehypeStringify).process(md))

describe('rehypeInlineCode', () => {
  it('puts each word of inline code in a nowrap span, spaces between them', async () => {
    expect(await render('Run `curl -v` now.')).toContain(
      '<code><span class="code-word">curl</span> <span class="code-word">-v</span></code>',
    )
  })

  it('leaves code blocks alone', async () => {
    expect(await render('```\ncurl -v\n```\n')).toContain('<pre><code>curl -v\n</code></pre>')
  })

  it('keeps a word too long for a phone breakable', async () => {
    const long = 'x'.repeat(MAX_NOWRAP_WORD + 1)
    expect(await render(`\`${long} -v\``)).toBe(`<p><code>${long} <span class="code-word">-v</span></code></p>`)
  })
})
