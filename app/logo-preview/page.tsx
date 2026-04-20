'use client'

// Direction 3: stacked lines (waveform/deck vibe)
function LogoD3({ size = 1 }: { size?: number }) {
  const w = 220 * size
  const h = 36 * size
  return (
    <svg width={w} height={h} viewBox="0 0 220 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Stacked bar icon */}
      <rect x="0" y="4" width="6" height="28" rx="1.5" fill="#00e5a0" />
      <rect x="10" y="10" width="6" height="16" rx="1.5" fill="#00e5a0" opacity="0.7" />
      <rect x="20" y="0" width="6" height="36" rx="1.5" fill="#00e5a0" />
      <rect x="30" y="8" width="6" height="20" rx="1.5" fill="#00e5a0" opacity="0.6" />
      {/* SHOWDECK text */}
      <text x="46" y="26" fontFamily="monospace" fontWeight="700" fontSize="18" letterSpacing="3" fill="white">SHOWDECK</text>
    </svg>
  )
}

// Direction 5: typography wordmark — stylised SHOWDECK with accent on the S
function LogoD5({ size = 1 }: { size?: number }) {
  const w = 240 * size
  const h = 36 * size
  return (
    <svg width={w} height={h} viewBox="0 0 240 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* S in green, rest in white */}
      <text x="0" y="28" fontFamily="monospace" fontWeight="900" fontSize="26" letterSpacing="1" fill="#00e5a0">S</text>
      <text x="18" y="28" fontFamily="monospace" fontWeight="900" fontSize="26" letterSpacing="1" fill="white">HOWDECK</text>
      {/* Underline accent */}
      <rect x="0" y="33" width="40" height="2" rx="1" fill="#00e5a0" />
    </svg>
  )
}

export default function LogoPreview() {
  return (
    <main className="min-h-screen bg-[#0d0d0f] text-white p-12">
      <h1 className="text-[#6b6b7a] text-xs uppercase tracking-widest mb-12">Logo Preview — pick one</h1>

      <div className="flex flex-col gap-16 max-w-2xl">

        {/* Direction 3 */}
        <div>
          <div className="text-[#6b6b7a] text-xs uppercase tracking-widest mb-6">Direction 3 — Stacked Lines</div>
          <div className="flex flex-col gap-8">
            <div className="bg-[#0d0d0f] border border-[#2a2a32] rounded-2xl p-8 flex items-center gap-8">
              <LogoD3 size={1} />
              <span className="text-[#3a3a45] text-xs">Standard</span>
            </div>
            <div className="bg-[#0d0d0f] border border-[#2a2a32] rounded-2xl p-8 flex items-center gap-8">
              <LogoD3 size={1.5} />
              <span className="text-[#3a3a45] text-xs">Large</span>
            </div>
            {/* In context: header bar */}
            <div className="bg-[#0d0d0f]/90 border border-[#2a2a32] rounded-xl px-6 h-14 flex items-center justify-between">
              <LogoD3 size={0.75} />
              <div className="flex gap-3">
                <span className="text-[#6b6b7a] text-sm">test@email.com</span>
                <span className="text-[#6b6b7a] border border-[#2a2a32] rounded-lg px-4 py-1 text-sm">Sign out</span>
              </div>
            </div>
            <div className="text-[#3a3a45] text-xs">↑ In header context</div>
          </div>
        </div>

        {/* Direction 5 */}
        <div>
          <div className="text-[#6b6b7a] text-xs uppercase tracking-widest mb-6">Direction 5 — Typography Wordmark</div>
          <div className="flex flex-col gap-8">
            <div className="bg-[#0d0d0f] border border-[#2a2a32] rounded-2xl p-8 flex items-center gap-8">
              <LogoD5 size={1} />
              <span className="text-[#3a3a45] text-xs">Standard</span>
            </div>
            <div className="bg-[#0d0d0f] border border-[#2a2a32] rounded-2xl p-8 flex items-center gap-8">
              <LogoD5 size={1.5} />
              <span className="text-[#3a3a45] text-xs">Large</span>
            </div>
            {/* In context: header bar */}
            <div className="bg-[#0d0d0f]/90 border border-[#2a2a32] rounded-xl px-6 h-14 flex items-center justify-between">
              <LogoD5 size={0.75} />
              <div className="flex gap-3">
                <span className="text-[#6b6b7a] text-sm">test@email.com</span>
                <span className="text-[#6b6b7a] border border-[#2a2a32] rounded-lg px-4 py-1 text-sm">Sign out</span>
              </div>
            </div>
            <div className="text-[#3a3a45] text-xs">↑ In header context</div>
          </div>
        </div>

      </div>

      <div className="mt-16 text-[#6b6b7a] text-sm">Tell Claude which direction and it'll roll it out across all pages.</div>
    </main>
  )
}
