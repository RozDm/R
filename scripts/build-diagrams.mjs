// Blog diagrams: content/diagrams/<slug>/<name>.svg → public/images/<slug>/<name>.svg.
//
// A post shows its images through <img>, and an SVG drawn that way can't load
// web fonts: its <text> would fall back to whatever monospace the reader's
// system has. So the source keeps live <text> (edit that), and the copy in
// public/ draws every text in Intel One Mono outlines, from Fontsource's WOFF
// files like the OG cards (lib/og-fonts.ts): one <path> per glyph, placed by
// <use>. After editing a source:  npm run diagrams
// tests/diagrams.test.ts fails while a copy is stale (`--check`).
//
// A source <text> is one line of plain text with x, y, font-size, fill and,
// if needed, font-weight="700" and text-anchor="middle" or "end"; no <tspan>,
// no CSS. Draw for the light theme on a white card: the dark theme inverts
// post diagrams (app/globals.css).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { inflateSync } from 'node:zlib'

const SOURCES = 'content/diagrams'
const OUTPUT = 'public/images'
const FONTS = 'node_modules/@fontsource/intel-one-mono/files'

// WOFF 1.0 with TrueType outlines → its sfnt tables, inflated.
function woffTables(buf) {
  if (buf.readUInt32BE(0) !== 0x774f4646 || buf.readUInt32BE(4) !== 0x00010000) {
    throw new Error('expected WOFF 1.0 with TrueType outlines')
  }
  const tables = {}
  for (let i = 0; i < buf.readUInt16BE(12); i++) {
    const entry = 44 + 20 * i
    const [offset, size, fullSize] = [4, 8, 12].map((k) => buf.readUInt32BE(entry + k))
    const data = buf.subarray(offset, offset + size)
    tables[buf.toString('latin1', entry, entry + 4)] = size < fullSize ? inflateSync(data) : data
  }
  return tables
}

// Code point → glyph id, from the Unicode cmap subtables (formats 4 and 12).
function charMap(cmap) {
  const map = new Map()
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    const [platform, encoding] = [cmap.readUInt16BE(4 + 8 * i), cmap.readUInt16BE(6 + 8 * i)]
    if (platform !== 0 && !(platform === 3 && (encoding === 1 || encoding === 10))) continue
    const o = cmap.readUInt32BE(8 + 8 * i)
    const format = cmap.readUInt16BE(o)
    if (format === 4) {
      const segments = cmap.readUInt16BE(o + 6) / 2
      const ends = o + 14
      const starts = ends + 2 * segments + 2
      const deltas = starts + 2 * segments
      const ranges = deltas + 2 * segments
      for (let s = 0; s < segments; s++) {
        const [start, end] = [cmap.readUInt16BE(starts + 2 * s), cmap.readUInt16BE(ends + 2 * s)]
        const [delta, range] = [cmap.readInt16BE(deltas + 2 * s), cmap.readUInt16BE(ranges + 2 * s)]
        for (let c = start; c <= end && c !== 0xffff; c++) {
          const glyph = range ? cmap.readUInt16BE(ranges + 2 * s + range + 2 * (c - start)) : c
          if (glyph && !map.has(c)) map.set(c, (glyph + delta) & 0xffff)
        }
      }
    } else if (format === 12) {
      for (let g = 0; g < cmap.readUInt32BE(o + 12); g++) {
        const [start, end, glyph] = [0, 4, 8].map((k) => cmap.readUInt32BE(o + 16 + 12 * g + k))
        for (let c = start; c <= end; c++) if (!map.has(c)) map.set(c, glyph + c - start)
      }
    }
  }
  return map
}

// A glyph's contours: lists of points, on or off the curve (glyf table).
function contours(font, id) {
  const start = font.loca(id)
  if (start === font.loca(id + 1)) return []
  const g = font.glyf.subarray(start)
  const count = g.readInt16BE(0)
  let p = 10

  if (count < 0) {
    // Composite: other glyphs, each moved (and maybe scaled) into place.
    const out = []
    let flags
    do {
      flags = g.readUInt16BE(p)
      const part = g.readUInt16BE(p + 2)
      p += 4
      if (!(flags & 2)) throw new Error(`glyph ${id}: components placed by point numbers are not supported`)
      const words = flags & 1
      const [dx, dy] = words ? [g.readInt16BE(p), g.readInt16BE(p + 2)] : [g.readInt8(p), g.readInt8(p + 1)]
      p += words ? 4 : 2
      const f2dot14 = () => ((p += 2), g.readInt16BE(p - 2) / 16384)
      let [a, b, c, d] = [1, 0, 0, 1]
      if (flags & 8) a = d = f2dot14()
      else if (flags & 0x40) [a, d] = [f2dot14(), f2dot14()]
      else if (flags & 0x80) [a, b, c, d] = [f2dot14(), f2dot14(), f2dot14(), f2dot14()]
      for (const contour of contours(font, part)) {
        out.push(contour.map(({ x, y, on }) => ({ x: a * x + c * y + dx, y: b * x + d * y + dy, on })))
      }
    } while (flags & 0x20)
    return out
  }

  const ends = Array.from({ length: count }, (_, i) => g.readUInt16BE(p + 2 * i))
  p += 2 * count
  p += 2 + g.readUInt16BE(p)
  const points = count ? ends[count - 1] + 1 : 0
  const flags = []
  while (flags.length < points) {
    const f = g[p++]
    flags.push(f)
    if (f & 8) for (let repeat = g[p++]; repeat > 0; repeat--) flags.push(f)
  }
  const axis = (short, same) => {
    let v = 0
    return flags.map((f) => {
      if (f & short) v += f & same ? g[p++] : -g[p++]
      else if (!(f & same)) v += g.readInt16BE((p += 2) - 2)
      return v
    })
  }
  const xs = axis(2, 16)
  const ys = axis(4, 32)
  const all = flags.map((f, i) => ({ x: xs[i], y: ys[i], on: (f & 1) === 1 }))
  return ends.map((end, i) => all.slice(i ? ends[i - 1] + 1 : 0, end + 1))
}

const num = (v) => String(Math.round(v * 1000) / 1000)
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true })

// Quadratic TrueType contours → SVG path data, y pointing down.
function pathData(list) {
  return list
    .map((points) => {
      const first = points.findIndex((q) => q.on)
      const ring = first < 0 ? [mid(points.at(-1), points[0]), ...points] : [...points.slice(first), ...points.slice(0, first)]
      const xy = (q) => `${num(q.x)} ${num(-q.y)}`
      let d = `M${xy(ring[0])}`
      let control = null
      for (let k = 1; k <= ring.length; k++) {
        const q = ring[k % ring.length]
        if (!q.on) {
          if (control) d += `Q${xy(control)} ${xy(mid(control, q))}`
          control = q
        } else if (control) {
          d += `Q${xy(control)} ${xy(q)}`
          control = null
        } else if (k < ring.length) d += `L${xy(q)}`
      }
      return d + 'Z'
    })
    .join('')
}

function loadFont(weight) {
  const t = woffTables(readFileSync(path.join(FONTS, `intel-one-mono-latin-${weight}-normal.woff`)))
  const longLoca = t.head.readInt16BE(50) === 1
  const metrics = t.hhea.readUInt16BE(34)
  const chars = charMap(t.cmap)
  const font = {
    glyf: t.glyf,
    loca: (id) => (longLoca ? t.loca.readUInt32BE(4 * id) : 2 * t.loca.readUInt16BE(2 * id)),
    unitsPerEm: t.head.readUInt16BE(18),
    glyph(char) {
      const id = chars.get(char.codePointAt(0))
      if (!id) throw new Error(`Intel One Mono (latin) has no "${char}"`)
      return { id, advance: t.hmtx.readUInt16BE(4 * Math.min(id, metrics - 1)), d: pathData(contours(font, id)) }
    },
  }
  return font
}

const FONT = { 400: loadFont(400), 700: loadFont(700) }
const ANCHOR = { start: 0, middle: 0.5, end: 1 }
const ATTRIBUTES = new Set(['x', 'y', 'font-size', 'font-weight', 'text-anchor', 'fill', 'font-family'])
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

// SVG's own whitespace rule (no xml:space): newlines go, runs of spaces fold.
const plainText = (raw) =>
  raw
    .replace(/[\r\n]/g, '')
    .replace(/\t/g, ' ')
    .trim()
    .replace(/ {2,}/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e) =>
      e[0] !== '#' ? (ENTITIES[e] ?? m) : String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))),
    )

// Source comments stay out of the copy. Taking one out can join the halves of
// another (`<!<!-- -->--` leaves `<!--`), so repeat until nothing changes,
// then refuse a comment that never closes.
function withoutComments(svg, file) {
  let previous
  do {
    previous = svg
    svg = svg.replace(/<!--[\s\S]*?-->/g, '')
  } while (svg !== previous)
  if (svg.includes('<!--')) throw new Error(`${file}: a comment that never closes (-->)`)
  return svg
}

export function outlineText(svg, file) {
  const glyphs = new Map()
  const body = withoutComments(svg, file).replace(/<text\b([^>]*)>([^<]*)<\/text>/g, (_, attrs, raw) => {
    const a = {}
    for (const [, name, value] of attrs.matchAll(/([\w:-]+)="([^"]*)"/g)) {
      if (!ATTRIBUTES.has(name)) throw new Error(`${file}: <text ${name}="…"> is not supported`)
      a[name] = value
    }
    const weight = a['font-weight'] ?? '400'
    const font = FONT[weight]
    const shift = ANCHOR[a['text-anchor'] ?? 'start']
    const [x, y, size] = [a.x, a.y, a['font-size']].map(Number)
    if (!font || shift === undefined || ![x, y, size].every(Number.isFinite)) {
      throw new Error(`${file}: <text${attrs}> needs numeric x, y and font-size, weight 400 or 700, anchor start, middle or end`)
    }
    const scale = size / font.unitsPerEm
    let pen = 0
    let uses = ''
    for (const char of plainText(raw)) {
      const glyph = font.glyph(char)
      const id = `${weight === '700' ? 'b' : 'r'}${glyph.id}`
      if (glyph.d) {
        glyphs.set(id, glyph.d)
        uses += `<use href="#${id}"${pen ? ` x="${pen}"` : ''}/>`
      }
      pen += glyph.advance
    }
    const left = x - pen * scale * shift
    const fill = a.fill ? ` fill="${a.fill}"` : ''
    return `<g${fill} transform="matrix(${num(scale)} 0 0 ${num(scale)} ${num(left)} ${num(y)})">${uses}</g>`
  })
  if (/<text\b/.test(body)) throw new Error(`${file}: <text> with markup inside (<tspan>?) is not supported`)
  // One element per line (a glyph, a text), so a diff or a grep stays short.
  const defs = `<defs>\n${[...glyphs].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('\n')}\n</defs>`
  return body.replace(/<svg\b[^>]*>/, (tag) => `${tag}\n${defs}`).replace(/>\s+</g, '>\n<').trim() + '\n'
}

function main() {
  const check = process.argv.includes('--check')
  const files = existsSync(SOURCES)
    ? readdirSync(SOURCES, { recursive: true }).filter((f) => f.endsWith('.svg')).sort()
    : []
  const stale = []
  for (const file of files) {
    const source = path.join(SOURCES, file)
    const target = path.join(OUTPUT, file)
    const svg = outlineText(readFileSync(source, 'utf8'), source)
    if (check) {
      if (!existsSync(target) || readFileSync(target, 'utf8') !== svg) stale.push(target)
      continue
    }
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, svg)
    console.log(`${target}: ${svg.length} bytes`)
  }
  if (stale.length) {
    console.error(`Out of date with content/diagrams/ (run npm run diagrams):\n  ${stale.join('\n  ')}`)
    process.exit(1)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
