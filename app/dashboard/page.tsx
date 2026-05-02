'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'
import GlobalSearch from '../../components/GlobalSearch'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [shows, setShows] = useState<any[]>([])
  const [epCounts, setEpCounts] = useState<Record<string, number>>({})
  const [epLastDate, setEpLastDate] = useState<Record<string, string>>({})
  const [epTitles, setEpTitles] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/'); return }
      setUser(data.user)
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      if (!profileData) { router.push('/profile/setup'); return }
      setProfile(profileData)

      // Owned shows
      const { data: ownedShows, error: showsError } = await supabase.from('shows').select('*').eq('owner_id', data.user.id)
      console.log('[dashboard] user id:', data.user.id)
      console.log('[dashboard] ownedShows:', ownedShows, 'error:', showsError)

      // Shows the user is a member of (via invite)
      const { data: memberRows, error: memberError } = await supabase
        .from('show_members')
        .select('show_id')
        .eq('user_id', data.user.id)
      console.log('[dashboard] memberRows:', memberRows, 'error:', memberError)

      const memberIds = (memberRows || []).map((r: any) => r.show_id).filter(Boolean)
      let memberShows: any[] = []
      if (memberIds.length > 0) {
        const { data: ms } = await supabase.from('shows').select('*').in('id', memberIds)
        memberShows = ms || []
      }

      // Merge, deduplicate by id
      const ownedIds = new Set((ownedShows || []).map((s: any) => s.id))
      const s = [
        ...(ownedShows || []),
        ...memberShows.filter((s: any) => !ownedIds.has(s.id)),
      ]
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
      setLoading(false)
    })
  }, [])

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
      <header className="bg-white border-b border-[#e2e4e8] px-8 h-14 flex items-center justify-between">
        <Logo size={0.75} />
        <div className="flex items-center gap-4">
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
          <div className="w-px h-5 bg-[#e2e4e8]" />
          <GlobalSearch />
          <div className="w-px h-5 bg-[#e2e4e8]" />
          <button onClick={signOut} className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-4 py-1.5 text-sm hover:text-[#0d0d0f] transition-colors">Sign out</button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-[#6b6b7a]">Loading…</div>
      ) : shows.length === 0 ? (
        <div className="max-w-sm mx-auto mt-24 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-white border border-[#e2e4e8] flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">🎙️</span>
          </div>
          <h2 className="text-xl font-bold mb-2">No shows yet</h2>
          <p className="text-[#6b6b7a] mb-6 text-sm">Create your first show to get started</p>
          <a href="/create-show" className="bg-[#00e5a0] text-black font-bold rounded-xl px-8 py-3 hover:bg-[#00ffc0] transition-colors inline-block">Create Show</a>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-xs font-semibold text-[#6b6b7a] uppercase tracking-widest">Your Shows</h1>
            <a href="/create-show" className="bg-[#00e5a0] text-black font-bold rounded-xl px-5 py-2.5 text-sm hover:bg-[#00ffc0] transition-colors">+ New Show</a>
          </div>

          {/* Search */}
          <div className="mb-6 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c8cad0] text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search shows…"
              className="w-full bg-white border border-[#e2e4e8] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#0d0d0f] outline-none focus:border-[#00e5a0] placeholder-[#c8cad0]"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#c8cad0] hover:text-[#6b6b7a] text-lg leading-none">×</button>
            )}
          </div>

          {filteredShows.length === 0 ? (
            <div className="text-center py-16 text-[#6b6b7a] text-sm">No shows match "{search}"</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredShows.map(show => (
                <a
                  key={show.id}
                  href={`/shows/${show.id}`}
                  className="group block rounded-2xl overflow-hidden border border-[#e2e4e8] bg-white
                    hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.10)] hover:border-[#00e5a0]
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
                        {show.show_type === 'radio' ? '📻 Radio'
                          : show.show_type === 'breakfast_radio' ? '🌅 Breakfast'
                          : show.show_type === 'drive' ? '🚗 Drive'
                          : show.show_type === 'evening' ? '🌙 Evening'
                          : '🎙️ Podcast'}
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
    </main>
  )
}
