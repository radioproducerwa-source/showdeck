'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { fetchAccessibleShows } from '../../lib/shows'
import { useAuthGuard } from '../../lib/useShowAccess'
import Logo from '../../components/Logo'
import GlobalSearch from '../../components/GlobalSearch'
import { IconMic, IconRadio, IconClipboard, IconLightbulb, IconArrowRight, IconPlus, IconSearch, IconX, IconLogOut } from '../../components/icons'

export default function Dashboard() {
  const { user, profile } = useAuthGuard({ requireProfile: true })
  const [shows, setShows] = useState<any[]>([])
  const [epCounts, setEpCounts] = useState<Record<string, number>>({})
  const [epLastDate, setEpLastDate] = useState<Record<string, string>>({})
  const [epTitles, setEpTitles] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [showWelcome, setShowWelcome] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const { all: s } = await fetchAccessibleShows(user.id)
        if (!localStorage.getItem('showdeck_welcomed')) {
          setShowWelcome(true)
        }
        setShows(s)

        if (s.length > 0) {
          const ids = s.map((x: any) => x.id)
          const { data: allEps } = await supabase
            .from('episodes').select('id, show_id, episode_date, title')
            .in('show_id', ids).order('episode_date', { ascending: false })
          const counts: Record<string, number> = {}
          const lastDates: Record<string, string> = {}
          const titles: Record<string, string[]> = {}
          ;(allEps || []).forEach((ep: any) => {
            counts[ep.show_id] = (counts[ep.show_id] || 0) + 1
            if (!lastDates[ep.show_id]) lastDates[ep.show_id] = ep.episode_date
            if (ep.title) {
              if (!titles[ep.show_id]) titles[ep.show_id] = []
              titles[ep.show_id].push(ep.title.toLowerCase())
            }
          })
          setEpCounts(counts)
          setEpLastDate(lastDates)
          setEpTitles(titles)
        }
      } catch {
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [user])

  const dismissWelcome = () => {
    localStorage.setItem('showdeck_welcomed', '1')
    setShowWelcome(false)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const getInitials = (name: string) =>
    (name || '').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '??'

  const getHostLine = (show: any) => {
    const parts = [show.host1_name, show.host2_name].filter(Boolean)
    if (show.has_producer && show.producer_name) parts.push(show.producer_name)
    return parts.join(' · ')
  }

  const formatLastDate = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  const filteredShows = shows.filter(s => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return s.name.toLowerCase().includes(q) ||
      (epTitles[s.id] || []).some(t => t.includes(q))
  })

  if (!user) return <div className="min-h-screen bg-[#f7f8fa]" />

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#0d0d0f] animate-page-in">
      {/* Nav */}
      <header className="bg-white border-b border-[#e2e4e8]">
        <div className="max-w-[2000px] mx-auto px-4 sm:px-8 lg:px-12 h-14 flex items-center justify-between">
        <Logo size={0.75} />
        <div className="flex items-center gap-2 sm:gap-4">
          <a href="/profile" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[#00e5a0] flex items-center justify-center">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
                : <span className="text-black text-sm font-bold">{profile?.display_name?.[0]?.toUpperCase()}</span>}
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-[#0d0d0f] leading-tight">{profile?.display_name}</div>
              <div className="text-[10px] text-[#6b6b7a] capitalize leading-tight">{profile?.role}</div>
            </div>
          </a>
          <div className="hidden sm:block w-px h-5 bg-[#e2e4e8]" />
          <GlobalSearch />
          <div className="hidden sm:block w-px h-5 bg-[#e2e4e8]" />
          <button onClick={signOut} className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 sm:px-4 py-1.5 text-sm hover:text-[#0d0d0f] transition-colors">
            <span className="hidden sm:inline">Sign out</span>
            <span className="sm:hidden flex items-center"><IconLogOut size={14} /></span>
          </button>
        </div>
        </div>
      </header>

      {loading ? (
        <div className="max-w-[2000px] mx-auto px-4 sm:px-8 lg:px-12 py-10">
          <div className="flex items-center justify-between mb-5">
            <div className="h-3 w-20 bg-[#e2e4e8] rounded animate-pulse" />
            <div className="h-9 w-28 bg-[#e2e4e8] rounded-xl animate-pulse" />
          </div>
          <div className="mb-6 h-10 bg-[#e2e4e8] rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-[#e2e4e8] bg-white">
                <div className="aspect-square bg-[#f0f1f3] animate-pulse" />
                <div className="px-5 py-4 border-t border-[#e2e4e8] space-y-2">
                  <div className="h-4 bg-[#e2e4e8] rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-[#e2e4e8] rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : loadError ? (
        <div className="max-w-md mx-auto mt-24 px-6 text-center">
          <p className="text-[#0d0d0f] font-semibold mb-2">Couldn&apos;t load your shows</p>
          <p className="text-[#6b6b7a] text-sm mb-6">Something went wrong while loading your dashboard. Please try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#00e5a0] text-black font-bold rounded-xl px-6 py-2.5 text-sm hover:bg-[#00ffc0] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : shows.length === 0 ? (
        <div className="max-w-md mx-auto mt-16 px-6">
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-[#00e5a0]/10 border border-[#00e5a0]/20 flex items-center justify-center mx-auto mb-5 text-[#00a870]">
              <IconMic size={28} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Welcome to Showdeck{profile?.display_name ? `, ${profile.display_name.split(' ')[0]}` : ''}</h2>
            <p className="text-[#6b6b7a] text-sm leading-relaxed">Your show planning workspace. Create a show, plan your segments, and go to air with everything sorted.</p>
          </div>

          <div className="flex flex-col gap-3 mb-8">
            {[
              { step: '1', title: 'Create your show', desc: 'Add your show name, hosts, and type — podcast or radio.' },
              { step: '2', title: 'Plan your episode', desc: 'Fill in each segment for your hosts, section by section.' },
              { step: '3', title: 'Export & go to air', desc: 'Download a PDF runsheet or open it on any device.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex items-start gap-4 bg-white border border-[#e2e4e8] rounded-xl px-5 py-4">
                <div className="w-7 h-7 rounded-full bg-[#00e5a0] flex items-center justify-center text-black text-xs font-black flex-shrink-0 mt-0.5">{step}</div>
                <div>
                  <p className="font-semibold text-sm text-[#0d0d0f]">{title}</p>
                  <p className="text-xs text-[#6b6b7a] mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <a href="/create-show" className="w-full bg-[#00e5a0] text-black font-semibold rounded-xl py-3.5 text-sm hover:bg-[#00d494] active:scale-[0.99] transition-all flex items-center justify-center gap-2">
            Create your first show <IconArrowRight size={14} />
          </a>
        </div>
      ) : (
        <div className="max-w-[2000px] mx-auto px-4 sm:px-8 lg:px-12 py-10">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-xs font-semibold text-[#6b6b7a] uppercase tracking-widest">Your Shows</h1>
            <a href="/create-show" className="bg-[#00e5a0] text-black font-semibold rounded-xl px-5 py-2.5 text-sm hover:bg-[#00d494] active:scale-[0.99] transition-all flex items-center gap-1.5"><IconPlus size={14} /> New show</a>
          </div>

          {/* Search */}
          <div className="mb-6 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c8cad0] flex items-center"><IconSearch size={14} /></span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search shows…"
              className="w-full bg-white border border-[#e2e4e8] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#0d0d0f] outline-none focus:border-[#00e5a0] placeholder-[#c8cad0]"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#c8cad0] hover:text-[#6b6b7a] flex items-center"><IconX size={14} /></button>
            )}
          </div>

          {filteredShows.length === 0 ? (
            <div className="text-center py-16 text-[#6b6b7a] text-sm">No shows match "{search}"</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
              {filteredShows.map(show => (
                <a
                  key={show.id}
                  href={`/shows/${show.id}`}
                  className="group block rounded-2xl overflow-hidden border border-[#e2e4e8] bg-white shadow-[0_1px_2px_rgba(13,13,15,0.04)]
                    hover:-translate-y-1 hover:shadow-[0_4px_16px_rgba(13,13,15,0.08)] hover:border-[#00e5a0]
                    transition-all duration-200 ease-out"
                >
                  {/* Artwork */}
                  <div className="aspect-square relative bg-[#f7f8fa]">
                    {show.logo_url ? (
                      <img src={show.logo_url} alt={show.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #edfdf6 0%, #d6f5ea 100%)' }}>
                        <span className="text-[4.5rem] font-black leading-none tracking-tighter select-none text-[#00a870]">
                          {getInitials(show.name)}
                        </span>
                      </div>
                    )}
                    {/* Type badge */}
                    <div className="absolute top-3 right-3">
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-sm text-white">
                        {show.show_type === 'radio' ? 'Radio'
                          : show.show_type === 'breakfast_radio' ? 'Breakfast'
                          : show.show_type === 'drive' ? 'Drive'
                          : show.show_type === 'evening' ? 'Evening'
                          : 'Podcast'}
                      </span>
                    </div>
                    {/* Episode count badge */}
                    {(epCounts[show.id] || 0) > 0 && (
                      <div className="absolute bottom-3 left-3">
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-black/65 backdrop-blur-sm text-white/90">
                          {epCounts[show.id]} {epCounts[show.id] === 1 ? 'episode' : 'episodes'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="px-5 py-4 border-t border-[#e2e4e8]">
                    <h2 className="font-bold text-[#0d0d0f] leading-snug group-hover:text-[#00a870] transition-colors duration-200 mb-1 truncate">
                      {show.name}
                    </h2>
                    {getHostLine(show) && (
                      <p className="text-xs text-[#6b6b7a] truncate mb-2">{getHostLine(show)}</p>
                    )}
                    {epLastDate[show.id] && (
                      <p className="text-[10px] text-[#c8cad0]">Last episode: {formatLastDate(epLastDate[show.id])}</p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
      {showWelcome && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-[#0d0d0f] px-8 pt-8 pb-6 text-center relative">
              <div className="w-14 h-14 rounded-2xl bg-[#00e5a0]/10 border border-[#00e5a0]/20 flex items-center justify-center mx-auto mb-4 text-[#00e5a0]">
                <IconMic size={24} />
              </div>
              <h2 className="text-white text-2xl font-bold mb-2">Welcome to Showdeck</h2>
              <p className="text-white/50 text-sm leading-relaxed">Your all-in-one workspace for planning radio and podcast shows — from episode ideas to live runsheets.</p>
            </div>
            <div className="px-8 py-6 space-y-4">
              {[
                { Icon: IconClipboard, title: 'Plan every episode', desc: 'Write your segments section by section, for each host and producer.' },
                { Icon: IconRadio, title: 'Radio runsheets', desc: 'Timed slots for your broadcast week, ready to go on air.' },
                { Icon: IconLightbulb, title: 'Ideas Board', desc: 'Capture show ideas and topics in columns — like a whiteboard for your team.' },
              ].map(({ Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-[#00e5a0]/10 text-[#00a870] flex items-center justify-center flex-shrink-0"><Icon size={16} /></div>
                  <div>
                    <p className="font-semibold text-sm text-[#0d0d0f]">{title}</p>
                    <p className="text-xs text-[#6b6b7a] mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-8 pb-8">
              <button
                onClick={dismissWelcome}
                className="w-full bg-[#00e5a0] text-black font-semibold rounded-xl py-3.5 text-sm hover:bg-[#00d494] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                Let's go <IconArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
