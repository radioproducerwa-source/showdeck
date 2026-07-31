import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0d0d0f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 15, height: 78, background: '#00e5a0', borderRadius: 4 }} />
          <div style={{ width: 15, height: 44, background: '#00e5a0', borderRadius: 4, opacity: 0.7 }} />
          <div style={{ width: 15, height: 100, background: '#00e5a0', borderRadius: 4 }} />
          <div style={{ width: 15, height: 56, background: '#00e5a0', borderRadius: 4, opacity: 0.6 }} />
        </div>
      </div>
    ),
    { ...size }
  )
}
