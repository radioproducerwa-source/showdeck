'use client'
import { useEffect, useState, use, useRef } from 'react'
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
  const [uploading, setUploading] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
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

  const uploadAvatar = async (slot: 'host1' | 'host2' | 'producer', file: File) => {
    const key = `${showId}-${slot}`
    setUploading(key)
    const ext = file.name.split('.').pop()
    const path = `${showId}-${slot}.${ext}`
    const { error: uploadError } = await supabase.storage.from('show-logos').upload(path, file, { upsert: true })
    if (uploadError) { alert('Upload failed: ' + uploadError.message); setUploading(null); return }
    const { data: { publicUrl } } = supabase.storage.from('show-logos').getPublicUrl(path)
    const field = slot === 'host1' ? 'host1_avatar' : slot === 'host2' ? 'host2_avatar' : 'producer_avatar'
    await supabase.from('shows').update({ [field]: publicUrl }).eq('id', showId)
    setShow((prev: any) => ({ ...prev, [field]: publicUrl }))
    setUploading(null)
  }

  const getInitials = (name: string) =>
    (name || '').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '??'

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

  const today = new Date().toLocaleDateString('en-CA')
  const isOnAir = currentEp?.episode_date === today

  const completedSections = sections.filter(s => getSectionStatus(s.name) === 'ready').length
  const completionPct = sections.length > 0 ? Math.round((completedSections / sections.length) * 100) : 0

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

  const hosts: Array<{ slot: 'host1' | 'host2' | 'producer'; name: string; avatar: string | null; color: string; label: string }> = ([
    { slot: 'host1' as const, name: show?.host1_name, avatar: show?.host1_avatar ?? null, color: '#00e5a0', label: 'Host 1' },
    { slot: 'host2' as const, name: show?.host2_name, avatar: show?.host2_avatar ?? null, color: '#ff5c3a', label: 'Host 2' },
    ...(show?.has_producer && show?.producer_name
      ? [{ slot: 'producer' as const, name: show.producer_name, avatar: show.producer_avatar ?? null, color: '#a78bfa', label: 'Producer' }]
      : [])
  ] as Array<{ slot: 'host1' | 'host2' | 'producer'; name: string; avatar: string | null; color: string; label: string }>).filter(h => h.name)

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#0d0d0f] animate-page-in">
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

        {/* ── Gradient Show Header ── */}
        <div className="relative rounded-2xl overflow-hidden">
          {/* Blurred background from logo */}
          {show?.logo_url ? (
            <div className="absolute inset-0 scale-110"
              style={{ backgroundImage: `url(${show.logo_url})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(32px) brightness(0.45)' }} />
          ) : (
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #003d2a 0%, #001f15 100%)' }} />
          )}
          {/* Fade-to-page-bg at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f7f8fa] to-transparent" />
          {/* Content */}
          <div className="relative z-10 px-7 pt-7 pb-10">
            <div className="flex items-start gap-5">
              {/* Logo */}
              <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg ring-2 ring-white/20">
                {show?.logo_url ? (
                  <img src={show.logo_url} alt={show.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#00e5a0]/20">
                    <span className="text-2xl font-black text-[#00e5a0]">{getInitials(show?.name || '')}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold text-white truncate">{show?.name}</h1>
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full flex-shrink-0 ${
                    show?.show_type === 'radio' ? 'bg-[#a78bfa]/25 text-[#c4b5fd]' : 'bg-[#00e5a0]/20 text-[#00e5a0]'
                  }`}>
                    {show?.show_type === 'radio' ? 'Radio' : 'Podcast'}
                  </span>
                </div>
                {/* Host row with upload */}
                <div className="flex flex-wrap items-center gap-3">
                  {hosts.map(h => {
                    const inputKey = `${showId}-${h.slot}`
                    return (
                      <div key={h.slot} className="flex items-center gap-2 group/av cursor-pointer"
                        onClick={() => fileInputs.current[inputKey]?.click()}
                        title={`Upload ${h.name}'s photo`}>
                        <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white/20">
                          {h.avatar
                            ? <img src={h.avatar} alt={h.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-black text-sm font-bold" style={{ backgroundColor: h.color }}>{h.name?.[0]}</div>}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-[9px] font-bold">{uploading === inputKey ? '…' : '↑'}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white leading-tight">{h.name}</div>
                          <div className="text-[10px] text-white/50">{h.label}</div>
                        </div>
                        <input ref={el => { fileInputs.current[inputKey] = el }} type="file" accept="image/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(h.slot, f) }} />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Current Episode ── */}
        {currentEp ? (
          <div className="relative bg-gradient-to-r from-[#edfdf6] to-white border border-[#00e5a0]/40 rounded-2xl px-6 py-5 flex items-center justify-between overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00e5a0] rounded-l-2xl" />
            <div className="pl-3 flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#00a870]">
                  {show?.show_type === 'radio' ? 'Current Broadcast' : 'Current Episode'}
                </div>
                {isOnAir && (
                  <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest bg-[#ff5c3a]/10 text-[#ff5c3a] border border-[#ff5c3a]/20 rounded-full px-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff5c3a] animate-pulse" />
                    On Air
                  </span>
                )}
                {!isOnAir && sections.length > 0 && completionPct > 0 && (
                  <span className="text-[9px] font-semibold text-[#6b6b7a] bg-[#f7f8fa] border border-[#e2e4e8] rounded-full px-2 py-0.5">
                    In Progress
                  </span>
                )}
              </div>
              <div className="text-xl font-bold leading-snug truncate">{currentEp.title || `Untitled ${epLabel}`}</div>
              <div className="text-sm text-[#6b6b7a] mt-1">{formatDate(currentEp.episode_date)}</div>
              {/* Completion indicator */}
              {sections.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#6b6b7a]">{completedSections}/{sections.length} sections complete</span>
                    <span className="text-[10px] font-semibold text-[#00a870]">{completionPct}%</span>
                  </div>
                  <div className="h-1.5 bg-[#e2e4e8] rounded-full overflow-hidden">
                    <div className="h-full bg-[#00e5a0] rounded-full transition-all duration-500"
                      style={{ width: `${completionPct}%` }} />
                  </div>
                </div>
              )}
            </div>
            <a href={`/planner/${showId}?episodeId=${currentEp.id}`}
              className="ml-6 bg-[#00e5a0] text-black font-bold rounded-xl px-6 py-3 text-sm hover:bg-[#00ffc0] transition-colors flex-shrink-0 shadow-sm">
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

        {/* ── Whiteboard ── */}
        {currentEp && sections.length > 0 && (
          <div className="rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
            style={{ border: '10px solid #2e2e2e', outline: '2px solid #3a3a3a' }}>
            {/* Top tray */}
            <div className="h-3 flex items-center px-4 gap-1.5" style={{ background: '#252525' }}>
              {['#555','#444','#333'].map((c, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
              ))}
            </div>
            {/* Board surface */}
            <div className="px-6 pt-5 pb-8"
              style={{ background: '#fafaf7', backgroundImage: 'repeating-linear-gradient(transparent, transparent 39px, #ece8e0 39px, #ece8e0 40px)' }}>
              <div className="flex items-center justify-between mb-8">
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ color: '#b0a898' }}>
                  {show?.name} — Episode Board
                </p>
                <a href={`/planner/${showId}?episodeId=${currentEp.id}`}
                  className="text-[10px] border rounded-lg px-3 py-1 transition-colors hover:text-[#1a1a1a]"
                  style={{ color: '#9a9080', borderColor: '#d8d0c4' }}>
                  Edit in planner →
                </a>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {sections.map((section: any, idx: number) => {
                  const status = getSectionStatus(section.name)
                  const preview = getSectionPreview(section.name)
                  const noteColor = idx % 2 === 0 ? '#cdf0e3' : '#f0e2cc'
                  const noteRotation = idx % 2 === 0 ? 'rotate(-1deg)' : 'rotate(1deg)'
                  const href = `/planner/${showId}?episodeId=${currentEp.id}#${section.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
                  const badgeBg = status === 'ready' ? 'rgba(0,168,112,0.18)' : status === 'draft' ? 'rgba(245,194,66,0.22)' : 'rgba(0,0,0,0.10)'
                  const badgeColor = status === 'ready' ? '#005c38' : status === 'draft' ? '#7a5200' : 'rgba(0,0,0,0.38)'
                  return (
                    <a key={section.id} href={href}
                      className="sticky-note relative block"
                      style={{ backgroundColor: noteColor, borderRadius: '2px', boxShadow: '2px 4px 16px rgba(0,0,0,0.14), 0 1px 3px rgba(0,0,0,0.08)', transform: noteRotation }}>
                      {/* Pushpin */}
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: 'radial-gradient(circle at 35% 35%, #ff8c6a, #cc3a20)', border: '1.5px solid #aa2e18', boxShadow: '0 2px 6px rgba(0,0,0,0.35)' }}>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.4)' }} />
                        </div>
                      </div>
                      {/* Note content */}
                      <div className="pt-5 px-4 pb-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="text-[8px] font-bold uppercase tracking-[0.16em] mb-1.5" style={{ color: 'rgba(0,0,0,0.25)' }}>
                              Segment {idx + 1}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <span className="text-base leading-none">{section.icon}</span>
                              <span className="font-bold text-[13px] leading-snug" style={{ color: '#1a1a1a' }}>{section.name}</span>
                            </div>
                          </div>
                          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: badgeBg, color: badgeColor }}>
                            {status}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed line-clamp-4 mt-3" style={{ color: '#3a3028' }}>
                          {preview || <span className="italic" style={{ color: 'rgba(0,0,0,0.25)' }}>No notes yet</span>}
                        </p>
                      </div>
                    </a>
                  )
                })}
              </div>
            </div>
            {/* Bottom tray */}
            <div className="h-5" style={{ background: '#252525' }} />
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
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${epLabelPlural}...`}
              className="w-full bg-[#f7f8fa] border border-[#e2e4e8] rounded-lg px-4 py-2 text-sm text-[#0d0d0f] outline-none focus:border-[#00e5a0] placeholder-[#c8cad0]" />
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
                      {episodes.indexOf(ep) === 0
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
