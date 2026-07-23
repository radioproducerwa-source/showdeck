'use client'
import { useState, use } from 'react'
import Logo from '../../../components/Logo'
import RadioPlannerPanel from '../../../components/RadioPlannerPanel'
import GlobalSearch from '../../../components/GlobalSearch'
import { useShowAccess } from '../../../lib/useShowAccess'

function getInitialDayFromUrl(): number | undefined {
  if (typeof window === 'undefined') return undefined
  const dateParam = new URLSearchParams(window.location.search).get('date')
  if (!dateParam) return undefined
  const dow = new Date(dateParam + 'T00:00:00').getDay() // 0=Sun
  return dow >= 1 && dow <= 5 ? dow - 1 : undefined // 0=Mon…4=Fri
}

export default function RadioPlannerPage({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = use(params)
  const access = useShowAccess(showId)
  const [initialDay] = useState<number | undefined>(getInitialDayFromUrl)

  if (access.status === 'loading') return (
    <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center text-[#6b6b7a]">Loading…</div>
  )

  if (access.status === 'error') return (
    <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center px-6">
      <div className="bg-white border border-[#e2e4e8] rounded-2xl px-8 py-10 text-center max-w-sm w-full">
        <p className="font-semibold text-[#0d0d0f] mb-1">Something went wrong</p>
        <p className="text-sm text-[#6b6b7a] mb-5">{access.message}</p>
        <button onClick={() => window.location.reload()}
          className="bg-[#00e5a0] text-black font-bold rounded-xl px-6 py-2.5 text-sm hover:bg-[#00ffc0] transition-colors">
          Retry
        </button>
      </div>
    </div>
  )

  const { show } = access

  return (
    <main className="min-h-screen bg-[#f7f8fa]">
      <header className="bg-white border-b border-[#e2e4e8] px-3 sm:px-6 h-14 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <a href={`/shows/${showId}`} className="text-[#6b6b7a] hover:text-[#0d0d0f] text-sm transition-colors flex-shrink-0">← <span className="hidden sm:inline">Show</span></a>
          <span className="text-[#e2e4e8] hidden sm:inline">|</span>
          <Logo size={0.65} />
          {show.logo_url && (
            <img src={show.logo_url} alt="logo" className="w-6 h-6 rounded object-cover opacity-80 flex-shrink-0" />
          )}
          <span className="text-[#6b6b7a] text-xs border-l border-[#e2e4e8] pl-2 sm:pl-3 truncate">{show.name}</span>
        </div>
        <GlobalSearch />
      </header>
      <div className="max-w-5xl mx-auto px-2 sm:px-6 py-4 sm:py-8">
        <RadioPlannerPanel showId={showId} show={show} initialDay={initialDay} />
      </div>
    </main>
  )
}
