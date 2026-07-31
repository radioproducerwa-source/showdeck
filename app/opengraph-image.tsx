import { ImageResponse } from 'next/og'

export const alt = 'Showdeck — Plan every episode, together'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const bar = (h: number, opacity = 1) => ({
  width: 22,
  height: h,
  background: '#00e5a0',
  borderRadius: 6,
  opacity,
})

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0d0d0f',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={bar(70)} />
            <div style={bar(40, 0.7)} />
            <div style={bar(90)} />
            <div style={bar(50, 0.6)} />
          </div>
          <div style={{ color: '#ffffff', fontSize: 34, fontWeight: 700, letterSpacing: 8 }}>
            SHOWDECK
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: '#ffffff', fontSize: 82, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>
            Plan every episode.
          </div>
          <div style={{ color: '#00e5a0', fontSize: 82, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>
            Together.
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 30, marginTop: 28 }}>
            The collaborative show planning workspace for podcast &amp; radio teams.
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
