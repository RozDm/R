// Images in blog posts — `![alt](/images/<slug>/file.webp)` in the markdown,
// the file in public/. One rehype plugin for the post page (PostPage's
// ReactMarkdown) and the RSS body (lib/markdown.ts); it runs at build and
// fails the build rather than ship a broken image:
//  - The pages' CSP takes images from 'self' and data: only (src/csp.ts): an
//    external image would be refused, silently, in every browser.
//  - A local image must exist; its width and height go on the <img>, so the
//    browser reserves the space before it loads (no layout shift), and it
//    loads lazily.
//  - Alt text is required — the post's images carry content, and axe checks.
//  - In the feed (`absolute`), src becomes an absolute URL: feed readers
//    resolve nothing against the site.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { SITE_URL } from './site'

interface HastNode {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

export interface PostImageOptions {
  // Named in error messages.
  post?: string
  // Absolute src for the feed.
  absolute?: boolean
  // Where root-relative paths resolve (tests point it elsewhere).
  publicDir?: string
}

export function rehypePostImages(options: PostImageOptions = {}) {
  const publicDir = resolve(options.publicDir ?? 'public')
  const where = options.post ? ` in post "${options.post}"` : ''

  const fix = (img: HastNode) => {
    const props = (img.properties ??= {})
    const raw = typeof props.src === 'string' ? props.src : ''
    if (!raw) throw new Error(`Image without a src${where}`)
    if (typeof props.alt !== 'string' || !props.alt.trim()) {
      throw new Error(`Image ${raw}${where} has no alt text: ![what it shows](${raw})`)
    }
    if (raw.startsWith('data:')) return

    // The site's own absolute URL is fine; any other origin is not.
    const src = raw.startsWith(SITE_URL + '/') ? raw.slice(SITE_URL.length) : raw
    if (/^([a-z][a-z\d+.-]*:|\/\/)/i.test(src)) {
      throw new Error(
        `External image ${raw}${where}: the CSP (img-src 'self' data:) blocks it. ` +
          'Put the file under public/images/<slug>/ and link it as /images/<slug>/…',
      )
    }
    if (!src.startsWith('/')) {
      throw new Error(`Image ${raw}${where}: use a path from the site root, /images/<slug>/…`)
    }

    const path = decodeURIComponent(src.split(/[?#]/)[0])
    const file = resolve(publicDir, '.' + path)
    if (!file.startsWith(publicDir + sep) || !existsSync(file) || !statSync(file).isFile()) {
      throw new Error(`Image ${raw}${where}: no such file in public/`)
    }
    const { width, height } = imageSize(readFileSync(file), path)
    props.src = options.absolute ? SITE_URL + src : src
    props.width = width
    props.height = height
    props.loading = 'lazy'
    props.decoding = 'async'
  }

  const walk = (node: HastNode) => {
    if (node.type === 'element' && node.tagName === 'img') fix(node)
    node.children?.forEach(walk)
  }
  return (tree: HastNode) => walk(tree)
}

const be16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1]
const le16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8)
const le24 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)
const be32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n))

// Intrinsic size from the file's own header: PNG, JPEG, GIF, WebP and SVG —
// the formats a post should use. Anything else fails the build.
export function imageSize(b: Uint8Array, name: string): { width: number; height: number } {
  if (b.length >= 24 && be32(b, 0) === 0x89504e47 && ascii(b, 12, 4) === 'IHDR') {
    return { width: be32(b, 16), height: be32(b, 20) }
  }
  if (b.length >= 10 && ascii(b, 0, 4) === 'GIF8') {
    return { width: le16(b, 6), height: le16(b, 8) }
  }
  if (b.length >= 30 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const chunk = ascii(b, 12, 4)
    if (chunk === 'VP8X') return { width: 1 + le24(b, 24), height: 1 + le24(b, 27) }
    if (chunk === 'VP8L' && b[20] === 0x2f) {
      return {
        width: 1 + (((b[22] & 0x3f) << 8) | b[21]),
        height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)),
      }
    }
    if (chunk === 'VP8 ') return { width: le16(b, 26) & 0x3fff, height: le16(b, 28) & 0x3fff }
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    // Walk the segments to the frame header (SOF0–SOF15, minus DHT, JPG, DAC).
    let i = 2
    while (i + 9 < b.length && b[i] === 0xff) {
      const marker = b[i + 1]
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: be16(b, i + 7), height: be16(b, i + 5) }
      }
      i += 2 + be16(b, i + 2)
    }
  }
  if (/\.svg$/i.test(name)) {
    const tag = new TextDecoder().decode(b).match(/<svg\b[^>]*>/i)?.[0] ?? ''
    const attr = (n: string) => tag.match(new RegExp(`\\s${n}="\\s*([\\d.]+)(px)?\\s*"`))?.[1]
    const [w, h] = [attr('width'), attr('height')]
    if (w && h) return { width: Math.round(Number(w)), height: Math.round(Number(h)) }
    const box = tag.match(/\sviewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/)
    if (box) return { width: Math.round(Number(box[1])), height: Math.round(Number(box[2])) }
  }
  throw new Error(`Image ${name}: can't read its size — use PNG, JPEG, GIF, WebP or an SVG with width/height or a viewBox`)
}
