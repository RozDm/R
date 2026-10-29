import { readFile } from 'node:fs/promises'
import path from 'node:path'

// Intel One Mono, the site's face, for the build-time social cards
// (lib/og-site-card.tsx, lib/og-post-card.tsx); without it next/og drew its
// default sans and no bold. Its renderer reads TTF/OTF/WOFF, not the WOFF2
// next/font serves, so the cards take Fontsource's WOFF files
// (@fontsource/intel-one-mono, a devDependency: only the build reads them).
// "latin" covers Norwegian and English; "latin-ext", a second family the
// renderer falls back to, the rest of a post title's Latin.
const FILES = path.join(process.cwd(), 'node_modules/@fontsource/intel-one-mono/files')

export const OG_FONT_FAMILY = '"Intel One Mono", "Intel One Mono Ext"'

export interface OgFont {
  name: string
  data: ArrayBuffer
  weight: 400 | 700
  style: 'normal'
}

let loaded: Promise<OgFont[]> | null = null

export function ogFonts(): Promise<OgFont[]> {
  loaded ??= Promise.all(
    (['latin', 'latin-ext'] as const).flatMap((subset) =>
      ([400, 700] as const).map(async (weight): Promise<OgFont> => {
        const file = await readFile(path.join(FILES, `intel-one-mono-${subset}-${weight}-normal.woff`))
        return {
          name: subset === 'latin' ? 'Intel One Mono' : 'Intel One Mono Ext',
          data: file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer,
          weight,
          style: 'normal',
        }
      }),
    ),
  )
  return loaded
}
