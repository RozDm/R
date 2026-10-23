import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import { imageSize, rehypePostImages, type PostImageOptions } from '@/lib/post-images'

// Real files (made with Pillow), so the header parsing is checked against
// what encoders write, not against hand-built bytes.
const FIXTURES = 'tests/fixtures'

describe('imageSize', () => {
  it.each([
    ['a.png', 3, 2],
    ['b.jpg', 5, 4],
    ['c-progressive.jpg', 300, 170],
    ['d.gif', 2, 7],
    ['e-lossy.webp', 9, 6],
    ['f-lossless.webp', 6, 9],
    ['g-alpha.webp', 17, 11],
    ['h.svg', 120, 40],
    ['i.svg', 64, 48],
  ])('%s is %i×%i', (file, width, height) => {
    expect(imageSize(readFileSync(`${FIXTURES}/images/${file}`), file)).toEqual({ width, height })
  })

  it('refuses a format it cannot read', () => {
    expect(() => imageSize(new TextEncoder().encode('not an image'), 'x.bmp')).toThrow(/can't read its size/)
  })
})

describe('rehypePostImages', () => {
  const render = (md: string, options: PostImageOptions = {}) =>
    String(
      unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypePostImages, { publicDir: FIXTURES, post: 'test', ...options })
        .use(rehypeStringify)
        .processSync(md),
    )

  it('gives a local image its size and lazy loading', () => {
    expect(render('![Et rødt kvadrat](/images/a.png)')).toBe(
      '<p><img src="/images/a.png" alt="Et rødt kvadrat" width="3" height="2" loading="lazy" decoding="async"></p>',
    )
  })

  it('takes the site’s own absolute URL, and writes absolute URLs for the feed', () => {
    expect(render('![Kvadrat](https://rozsoshnykh.no/images/a.png)')).toContain('src="/images/a.png"')
    expect(render('![Kvadrat](/images/a.png)', { absolute: true })).toContain(
      'src="https://rozsoshnykh.no/images/a.png"',
    )
  })

  it('fails on what the page could not show', () => {
    expect(() => render('![Logo](https://cdn.example.com/logo.png)')).toThrow(/CSP/)
    expect(() => render('![Logo](//cdn.example.com/logo.png)')).toThrow(/CSP/)
    expect(() => render('![Kvadrat](images/a.png)')).toThrow(/site root/)
    expect(() => render('![](/images/a.png)')).toThrow(/no alt text/)
    expect(() => render('![Mangler](/images/missing.png)')).toThrow(/no such file/)
    expect(() => render('![Utenfor](/../../package.json)')).toThrow(/no such file/)
  })

  it('leaves a data: URI alone (the CSP allows it)', () => {
    expect(render('![Prikk](data:image/gif;base64,R0lGODlhAQABAAAAACw=)')).toContain(
      'src="data:image/gif;base64,R0lGODlhAQABAAAAACw="',
    )
  })
})

// The post page renders with ReactMarkdown (components/blog/PostPage.tsx):
// the attributes must survive its hast → React step too.
it('reaches the page through ReactMarkdown', () => {
  const html = renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      { rehypePlugins: [[rehypePostImages, { publicDir: FIXTURES }]] },
      '![Kvadrat](/images/e-lossy.webp)',
    ),
  )
  expect(html).toContain('width="9" height="6" loading="lazy" decoding="async"')
})

