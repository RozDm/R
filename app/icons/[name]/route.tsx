import { ImageResponse } from 'next/og'

// PNG renditions of app/icon.svg (the HAL eye) for the places that won't take
// an SVG: the web-app manifest (Android/Chrome install needs 192 + 512 PNGs)
// and iOS's home-screen icon (apple-touch-icon). Emitted at build time as
// real .png files under /icons/, so the static host serves them with the
// right type — unlike the extension-less opengraph-image outputs.
export const dynamic = 'force-static'

const SIZES: Record<string, number> = {
  'icon-192.png': 192,
  'icon-512.png': 512,
  'apple-touch-icon.png': 180,
}

export function generateStaticParams() {
  return Object.keys(SIZES).map((name) => ({ name }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const size = SIZES[name] ?? 192
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
