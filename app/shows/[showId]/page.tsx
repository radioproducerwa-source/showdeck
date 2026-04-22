'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Logo from '../../../components/Logo'

export default function ShowDetail({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = use(params)
  const [show, setShow] = useState<any>(null)
  const [currentEp, setCurrentEp] = useState<any>(null)
  const [sections, setSections] = useState<any[]>([])
  const [contentMap, setContentMap] = useState<Record<string, string>>({})
  const [episodes, setEpisodes] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      Promise.all([
        supabase.from('shows').select('*').eq('id', showId).single(),
        supabase.from('episodes').select('*').eq('show_id', showId).order('episode_date', { ascending: false }).order('id', { ascending: false })
      ]).then(([{ data: showData }, { data: eps }]) => {
        setShow(showData)
        const allEps = eps || []
        setEpisodes(allEps)
        const latest = allEps[0]
        if (latest) {
          setCurrentEp(latest)
          Promise.all([
            supabase.from('sections').select('*').eq('episode_id', latest.id),
            supabase.from('section_content').select('*').eq('episode_id', latest.id)
          ]).then(([{ data: secs }, { data: contentRows }]) => {
            setSections(secs || [])
            const map: Record<string, string> = {}
            contentRows?.forEach((r: any) => { map[`${r.section_name}-${r.role}`] = r.content })
            setContentMap(map)
            setLoading(false)
          })
        } else {
          setLoading(false)
        }
      })
    })
  }, [])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const formatDateShort = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  const deleteEpisode = async (episodeId: string, title: string) => {
    if (!confirm(`Delete "${title || 'Untitled Episode'}"? This can't be undone.`)) return
    await supabase.from('section_content').delete().eq('episode_id', episodeId)
    await supabase.from('sections').delete().eq('episode_id', episodeId)
    await supabase.from('episodes').delete().eq('id', episodeId)
    setEpisodes(prev => prev.filter(e => e.id !== episodeId))
    if (currentEp?.id === episodeId) setCurrentEp(null)
  }

  const getSectionPreview = (sectionName: string) => {
    const text = (contentMap[`${sectionName}-host1`] || '') || (contentMap[`${sectionName}-host2`] || '')
    return text.split('\n')[0].slice(0, 100) || null
  }

  const getSectionStatus = (sectionName: string) => {
    const total = (contentMap[`${sectionName}-host1`] || '').length + (contentMap[`${sectionName}-host2`] || '').length
    if (total === 0) return 'empty'
    if (total < 20) return 'draft'
    return 'ready'
  }

  const getInitials = (name: string) =>
    (name || '').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '??'

  const filtered = episodes.filter(ep => {
    const q = search.toLowerCase()
    return !q || (ep.title || '').toLowerCase().includes(q) || formatDateShort(ep.episode_date).toLowerCase().includes(q)
  })

  if (loading) return (
    <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center">
      <div className="text-[#6b6b7a]">Loading...</div>
    </div>
  )

  const epLabel = show?.show_type === 'radio' ? 'Broadcast' : 'Episode'
  const epLabelPlural = show?.show_type === 'radio' ? 'broadcasts' : 'episodes'

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#0d0d0f]">
      {/* Nav */}
      <header className="bg-white border-b border-[#e2e4e8] px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-[#6b6b7a] hover:text-[#0d0d0f] text-sm transition-colors">← Dashboard</a>
          <span className="text-[#e2e4e8]">|</span>
          <Logo size={0.65} />
        </div>
        {show && (
          <div className="flex items-center gap-2">
            <a href={`/show-settings/${showId}`} className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 text-sm hover:text-[#0d0d0f] transition-colors">Settings</a>
            <a href={`/planner/${showId}?new=true`} className="bg-[#00e5a0] text-black font-bold rounded-lg px-4 py-1.5 text-sm hover:bg-[#00ffc0] transition-colors">
              + New {epLabel}
            </a>
          </div>
        )}
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">

        {/* ── Show Info Card ── */}
        <div className="bg-white border border-[#e2e4e8] rounded-2xl p-6">
          <div className="flex items-start gap-5">
            {/* Logo */}
            <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 border border-[#e2e4e8] bg-[#f7f8fa]">
              {show?.logo_url ? (
                <img src={show.logo_url} alt={show.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #edfdf6 0%, #d6f5ea 100%)' }}>
                  <span className="text-2xl font-black text-[#00a870]">{getInitials(show?.name || '')}</span>
                </div>
              )}
            </div>

            {/* Name + hosts */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <h1 className="text-2xl font-bold truncate">{show?.name}</h1>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full flex-shrink-0 ${
                  show?.show_type === 'radio'
                    ? 'bg-[#a78bfa]/15 text-[#7c3aed]'
                    : 'bg-[#00e5a0]/20 text-[#00a870]'
                }`}>
                  {show?.show_type === 'radio' ? 'Radio' : 'Podcast'}
                </span>
              </div>

              {/* Host avatars */}
              <div className="flex flex-wrap items-center gap-4">
                {([
                  { slot: 'host1', name: show?.host1_name, avatar: show?.host1_avatar, color: '#00e5a0', label: 'Host 1' },
                  { slot: 'host2', name: show?.host2_name, avatar: show?.host2_avatar, color: '#ff5c3a', label: 'Host 2' },
                  ...(show?.has_producer && show?.producer_name
                    ? [{ slot: 'producer', name: show.producer_name, avatar: show.producer_avatar, color: '#a78bfa', label: 'Producer' }]
                    : [])
                ] as Array<{ slot: string; name: string; avatar: string | null; color: string; label: string }>)
                  .filter(h => h.name)
                  .map(h => (
                    <div key={h.slot} className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0" style={{ background: h.color }}>
                        {h.avatar
                          ? <img src={h.avatar} alt={h.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-black text-sm font-bold">{h.name?.[0]}</div>}
                      </div>
                      <div>
                        <div className="text-sm font-semibold leading-tight">{h.name}</div>
                        <div className="text-[10px] text-[#6b6b7a]">{h.label}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Current Episode ── */}
        {currentEp ? (
          <div className="relative bg-gradient-to-r from-[#edfdf6] to-white border border-[#00e5a0]/40 rounded-2xl px-6 py-5 flex items-center justify-between overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00e5a0] rounded-l-2xl" />
            <div className="pl-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00a870] mb-1.5">
                {show?.show_type === 'radio' ? 'Current Broadcast' : 'Current Episode'}
              </div>
              <div className="text-xl font-bold leading-snug">{currentEp.title || `Untitled ${epLabel}`}</div>
              <div className="text-sm text-[#6b6b7a] mt-1">{formatDate(currentEp.episode_date)}</div>
            </div>
            <a href={`/planner/${showId}?episodeId=${currentEp.id}`}
              className="bg-[#00e5a0] text-black font-bold rounded-xl px-6 py-3 text-sm hover:bg-[#00ffc0] transition-colors flex-shrink-0 shadow-sm">
              Open Planner →
            </a>
          </div>
        ) : (
          <div className="bg-white border border-[#e2e4e8] rounded-2xl px-6 py-5 flex items-center justify-between">
            <span className="text-[#6b6b7a] text-sm">No {epLabelPlural} yet</span>
            <a href={`/planner/${showId}?new=true`} className="bg-[#00e5a0] text-black font-bold rounded-lg px-5 py-2 text-sm hover:bg-[#00ffc0] transition-colors">
              + New {epLabel}
            </a>
          </div>
        )}

        {/* ── Segments Preview ── */}
        {currentEp && sections.length > 0 && (
          <div className="bg-white border border-[#e2e4e8] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e2e4e8] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6b6b7a] uppercase tracking-widest">Segments</span>
              <a href={`/planner/${showId}?episodeId=${currentEp.id}`}
                className="text-xs text-[#6b6b7a] hover:text-[#0d0d0f] transition-colors">Edit in planner →</a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[#e2e4e8]">
              {sections.map((section: any) => {
                const status = getSectionStatus(section.name)
                const preview = getSectionPreview(section.name)
                return (
                  <a key={section.id}
                    href={`/planner/${showId}?episodeId=${currentEp.id}#${section.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    className="bg-white p-4 hover:bg-[#f7fffe] transition-colors group flex flex-col gap-2 min-h-[100px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base leading-none">{section.icon}</span>
                      <span className="text-xs font-semibold text-[#0d0d0f] group-hover:text-[#00a870] transition-colors">{section.name}</span>
                      {status === 'ready' && (
                        <span className="ml-auto w-3.5 h-3.5 bg-[#00a870] rounded-full flex items-center justify-center text-white text-[8px] flex-shrink-0">✓</span>
                      )}
                      {status === 'draft' && (
                        <span className="ml-auto w-2 h-2 bg-[#f5c842] rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#6b6b7a] leading-relaxed line-clamp-3 flex-1">
                      {preview || <span className="italic text-[#c8cad0]">No notes yet</span>}
                    </p>
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Episode Archive ── */}
        <div className="bg-white border border-[#e2e4e8] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e2e4e8] flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold">{show?.show_type === 'radio' ? 'Broadcast Archive' : 'Episode Archive'}</span>
              <span className="text-xs text-[#6b6b7a] ml-2">{episodes.length} {epLabelPlural}</span>
            </div>
          </div>

          <div className="px-6 py-3 border-b border-[#e2e4e8]">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${epLabelPlural}...`}
              className="w-full bg-[#f7f8fa] border border-[#e2e4e8] rounded-lg px-4 py-2 text-sm text-[#0d0d0f] outline-none focus:border-[#00e5a0] placeholder-[#c8cad0]"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-[#6b6b7a] text-sm mb-4">
                {search ? `No ${epLabelPlural} match your search.` : `No ${epLabelPlural} yet. Create your first one!`}
              </p>
              {!search && (
                <a href={`/planner/${showId}?new=true`}
                  className="inline-block bg-[#00e5a0] text-black font-bold rounded-xl px-6 py-2.5 text-sm hover:bg-[#00ffc0] transition-colors">
                  + New {epLabel}
                </a>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#e2e4e8]">
              {filtered.map((ep) => (
                <div key={ep.id} className="flex items-center justify-between px-6 py-4 hover:bg-[#f7f8fa] transition-colors group">
                  <a href={`/planner/${showId}?episodeId=${ep.id}`} className="flex-1 flex items-center gap-4 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#f7f8fa] border border-[#e2e4e8] flex items-center justify-center text-xs font-bold text-[#6b6b7a] flex-shrink-0">
                      {episodes.indexOf(ep) + 1 === 1
                        ? <span className="text-[#00a870]">▶</span>
                        : episodes.length - episodes.indexOf(ep)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-[#0d0d0f] group-hover:text-[#00a870] transition-colors truncate">
                        {ep.title || `Untitled ${epLabel}`}
                      </div>
                      <div className="text-[#6b6b7a] text-xs mt-0.5">{formatDateShort(ep.episode_date)}</div>
                    </div>
                  </a>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <a href={`/planner/${showId}?episodeId=${ep.id}`}
                      className="text-xs text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 hover:text-[#0d0d0f] transition-colors opacity-0 group-hover:opacity-100">
                      Open
                    </a>
                    <button onClick={() => deleteEpisode(ep.id, ep.title)}
                      className="text-[#c8cad0] hover:text-[#ff5c3a] text-lg leading-none opacity-0 group-hover:opacity-100 transition-all"
                      title={`Delete ${epLabel.toLowerCase()}`}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
