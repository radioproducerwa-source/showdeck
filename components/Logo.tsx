export function LogoIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="4" width="6" height="28" rx="1.5" fill="#00e5a0" />
      <rect x="10" y="10" width="6" height="16" rx="1.5" fill="#00e5a0" opacity="0.7" />
      <rect x="20" y="0" width="6" height="36" rx="1.5" fill="#00e5a0" />
      <rect x="30" y="8" width="6" height="20" rx="1.5" fill="#00e5a0" opacity="0.6" />
    </svg>
  )
}

export default function Logo({ size = 1, light = false }: { size?: number; light?: boolean }) {
  const w = 220 * size
  const h = 36 * size
  return (
    <svg width={w} height={h} viewBox="0 0 220 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="4" width="6" height="28" rx="1.5" fill="#00e5a0" />
      <rect x="10" y="10" width="6" height="16" rx="1.5" fill="#00e5a0" opacity="0.7" />
      <rect x="20" y="0" width="6" height="36" rx="1.5" fill="#00e5a0" />
      <rect x="30" y="8" width="6" height="20" rx="1.5" fill="#00e5a0" opacity="0.6" />
      <text x="46" y="26" fontFamily="monospace" fontWeight="700" fontSize="18" letterSpacing="3" fill={light ? '#ffffff' : '#0d0d0f'}>SHOWDECK</text>
    </svg>
  )
}
