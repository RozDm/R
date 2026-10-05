import { ImageResponse } from 'next/og'

// PNG renditions of app/icon.svg (the HAL eye) for the places that won't take
// an SVG: the web-app manifest (Android/Chrome install needs 192 + 512 PNGs)
// and iOS's home-screen icon (apple-touch-icon). Emitted at build time as
// real .png files under /icons/, so the static host serves them with the
// right type — unlike the extension-less opengraph-image outputs. Also
// favicon.ico (16/32/48), which the Worker serves at /favicon.ico for
// clients that request it directly instead of reading <link rel=icon>.
export const dynamic = 'force-static'

const SIZES: Record<string, number> = {
  'icon-192.png': 192,
  'icon-512.png': 512,
  'apple-touch-icon.png': 180,
  'favicon.ico': 48,
}

const ICO_SIZES = [16, 32, 48]

export function generateStaticParams() {
  return Object.keys(SIZES).map((name) => ({ name }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  if (name === 'favicon.ico') {
    const frames = await Promise.all(
      ICO_SIZES.map(async (size) => ({ size, png: new Uint8Array(await renderIcon(size).arrayBuffer()) })),
    )
    return new Response(toIco(frames), { headers: { 'Content-Type': 'image/x-icon' } })
  }
  return renderIcon(SIZES[name] ?? 192)
}

// ICO container around PNG frames (PNG-in-ICO, read by every browser since
// IE/Vista): a 6-byte header, a 16-byte directory entry per frame, then the
// PNG bytes back to back.
function toIco(frames: { size: number; png: Uint8Array }[]): Uint8Array<ArrayBuffer> {
  const headerBytes = 6 + 16 * frames.length
  const out = new Uint8Array(headerBytes + frames.reduce((n, f) => n + f.png.length, 0))
  const view = new DataView(out.buffer)
  view.setUint16(2, 1, true) // type: icon
  view.setUint16(4, frames.length, true)
  let offset = headerBytes
  frames.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i
    out[entry] = size // width (0 would mean 256)
    out[entry + 1] = size // height
    view.setUint16(entry + 4, 1, true) // colour planes
    view.setUint16(entry + 6, 32, true) // bits per pixel
    view.setUint32(entry + 8, png.length, true)
    view.setUint32(entry + 12, offset, true)
    out.set(png, offset)
    offset += png.length
  })
  return out
}

function renderIcon(size: number) {
  // Eye at ~62% of the tile: inside the maskable safe zone (80%) so Android's
  // circle/squircle masks never clip it.
  const eye = Math.round(size * 0.62)
  const core = Math.round(eye * 0.28)
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#030712',
        }}
      >
        <div
          style={{
            width: eye,
            height: eye,
            borderRadius: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage:
              'radial-gradient(circle, #ff2020 0%, #cc0000 25%, #800000 45%, #3d0000 65%, #1a0a0a 100%)',
          }}
        >
          <div style={{ width: core, height: core, borderRadius: 9999, background: '#ffc864' }} />
        </div>
      </div>
    ),
    { width: size, height: size },
  )
}
