import { ImageResponse } from 'next/og'

// 512x512 maskable PWA icon (referenced from app/manifest.ts)
export function GET() {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ width: 44, height: 230, background: '#00e5a0', borderRadius: 12 }} />
          <div style={{ width: 44, height: 130, background: '#00e5a0', borderRadius: 12, opacity: 0.7 }} />
          <div style={{ width: 44, height: 290, background: '#00e5a0', borderRadius: 12 }} />
          <div style={{ width: 44, height: 160, background: '#00e5a0', borderRadius: 12, opacity: 0.6 }} />
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  )
}
