'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Logo from '../../../components/Logo'
import RadioPlannerPanel from '../../../components/RadioPlannerPanel'
import GlobalSearch from '../../../components/GlobalSearch'

function getInitialDayFromUrl(): number | undefined {
  if (typeof window === 'undefined') return undefined
  const dateParam = new URLSearchParams(window.location.search).get('date')
  if (!dateParam) return undefined
  const dow = new Date(dateParam + 'T00:00:00').getDay() // 0=Sun
  return dow >= 1 && dow <= 5 ? dow - 1 : undefined // 0=Mon…4=Fri
}

export default function RadioPlannerPage({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = use(params)
  const [show, setShow] = useState<any>(null)
  const [initialDay] = useState<number | undefined>(getInitialDayFromUrl)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      supabase.from('shows').select('*').eq('id', showId).single().then(async ({ data: showData }) => {
        if (!showData) { router.push('/dashboard'); return }
        if (showData.owner_id !== data.user!.id) {
          const { data: membership } = await supabase.from('show_members').select('id').eq('show_id', showId).eq('user_id', data.user!.id).maybeSingle()
          if (!membership) { router.push('/dashboard'); return }
        }
        setShow(showData)
      })
    })
  }, [])

  if (!show) return (
    <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center text-[#6b6b7a]">Loading…</div>
  )

  return (
    <main className="min-h-screen bg-[#f7f8fa]">
      <header className="bg-white border-b border-[#e2e4e8] px-6 h-14 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <a href={`/shows/${showId}`} className="text-[#6b6b7a] hover:text-[#0d0d0f] text-sm transition-colors">← Show</a>
          <span className="text-[#e2e4e8]">|</span>
          <Logo size={0.65} />
          {show.logo_url && (
            <img src={show.logo_url} alt="logo" className="w-6 h-6 rounded object-cover opacity-80" />
          )}
          <span className="text-[#6b6b7a] text-xs border-l border-[#e2e4e8] pl-3">{show.name}</span>
        </div>
        <GlobalSearch />
      </header>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <RadioPlannerPanel showId={showId} show={show} initialDay={initialDay} />
      </div>
    </main>
  )
}
