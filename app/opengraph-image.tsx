import { ImageResponse } from 'next/og'

export const dynamic = 'force-static'
export const alt = 'Dmytro Rozsoshnykh — Systemadministrator & DevOps'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#030712',
          padding: 80,
        }}
      >
        {/* HAL 9000 eye */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 110,
            height: 110,
            borderRadius: 9999,
            background: '#cc0000',
            boxShadow: '0 0 70px 24px rgba(220,0,0,0.35)',
          }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 9999, background: '#ffd27f' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: '#f87171', fontSize: 26, letterSpacing: 4 }}>
            SYSTEMADMINISTRATOR / DEVOPS / UTVIKLER
          </div>
          <div style={{ color: '#ffffff', fontSize: 84, fontWeight: 700, marginTop: 16, lineHeight: 1.05 }}>
            Dmytro Rozsoshnykh
          </div>
          <div style={{ color: '#94a3b8', fontSize: 30, marginTop: 24 }}>
            Infrastruktur · Automatisering · Sikkerhet
          </div>
        </div>

        <div style={{ display: 'flex', color: '#475569', fontSize: 24 }}>
          rozsoshnykh.no
        </div>
      </div>
    ),
    { ...size },
  )
}
