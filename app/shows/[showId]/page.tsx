'use client'
import { useEffect, useState, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Logo from '../../../components/Logo'
import GlobalSearch from '../../../components/GlobalSearch'

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
  const [radioWeeks, setRadioWeeks] = useState<string[]>([])
  const [todaySlots, setTodaySlots] = useState<Record<string, { title: string; notes: string }>>({})
  const [archiveSearch, setArchiveSearch] = useState('')
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
        if (['radio', 'breakfast_radio', 'drive', 'evening'].includes(showData?.show_type)) {
          const todayDate = new Date().toLocaleDateString('en-CA')
          Promise.all([
            supabase.from('radio_plans').select('plan_date').eq('show_id', showId),
            supabase.from('radio_plans').select('hour,slot_key,title,notes').eq('show_id', showId).eq('plan_date', todayDate),
          ]).then(([{ data: planRows }, { data: todayRows }]) => {
            if (planRows) {
              const seen = new Set<string>()
              planRows.forEach((r: any) => {
                const d = new Date(r.plan_date + 'T00:00:00')
                const day = d.getDay()
                const mon = new Date(d)
                mon.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
                seen.add(mon.toLocaleDateString('en-CA'))
              })
              setRadioWeeks(Array.from(seen).sort().reverse())
            }
            if (todayRows) {
              const map: Record<string, { title: string; notes: string }> = {}
              todayRows.forEach((r: any) => { map[`${r.hour}-${r.slot_key}`] = { title: r.title || '', notes: r.notes || '' } })
              setTodaySlots(map)
            }
          })
        }
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

  const currentWeekRange = () => {
    const today = new Date()
    const day = today.getDay()
    const mon = new Date(today)
    mon.setDate(today.getDate() + (day === 0 ? -6 : 1 - day))
    const fri = new Date(mon)
    fri.setDate(mon.getDate() + 4)
    return `${mon.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${fri.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
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

  const isRadio = ['radio', 'breakfast_radio', 'drive', 'evening'].includes(show?.show_type)
  const epLabel = isRadio ? 'Broadcast' : 'Episode'
  const epLabelPlural = isRadio ? 'broadcasts' : 'episodes'

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
            <GlobalSearch />
            <a href={`/show-settings/${showId}`} className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 text-sm hover:text-[#0d0d0f] transition-colors">Settings</a>
            {!isRadio && (
              <a href={`/planner/${showId}?new=true`} className="bg-[#00e5a0] text-black font-bold rounded-lg px-4 py-1.5 text-sm hover:bg-[#00ffc0] transition-colors">
                + New {epLabel}
              </a>
            )}
          </div>
        )}
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">

        {/* ── Show Header ── */}
        <div className="relative rounded-2xl overflow-hidden">
          {/* Header banner with per-show colour */}
          {(() => {
            const hc = show?.header_color || '#00e5a0'
            const bg = hc === '#0d0d0f'
              ? 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0f 100%)'
              : `linear-gradient(135deg, ${hc}40 0%, #0d0d0f 100%)`
            return <div className="absolute inset-0" style={{ background: bg }} />
          })()}
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
                    isRadio ? 'bg-[#a78bfa]/25 text-[#c4b5fd]' : 'bg-[#00e5a0]/20 text-[#00e5a0]'
                  }`}>
                    {show?.show_type === 'breakfast_radio' ? '🌅 Breakfast'
                      : show?.show_type === 'drive' ? '🚗 Drive'
                      : show?.show_type === 'evening' ? '🌙 Evening'
                      : isRadio ? '📻 Radio'
                      : '🎙️ Podcast'}
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

        {/* ── Radio: Current Runsheet card + Today's Show + Archive ── */}
        {isRadio && (() => {
          const SLOT_KEYS = ['03', '10', '20', '33', '40', '5055']
          const HOURS = [6, 7, 8]
          const totalSlots = SLOT_KEYS.length * HOURS.length
          const filledCount = HOURS.reduce((acc, h) =>
            acc + SLOT_KEYS.filter(k => todaySlots[`${h}-${k}`]?.title?.trim()).length, 0)
          const fillPct = Math.round((filledCount / totalSlots) * 100)
          const todayDow = new Date().getDay() // 0=Sun
          const isWeekday = todayDow >= 1 && todayDow <= 5

          const filteredWeeks = archiveSearch.trim()
            ? radioWeeks.filter(mondayStr => {
                const mon = new Date(mondayStr + 'T00:00:00')
                const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
                const lbl = `${mon.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} ${fri.toLocaleDateString('en-AU', { month: 'long' })}`
                return lbl.toLowerCase().includes(archiveSearch.toLowerCase())
              })
            : radioWeeks

          return (
            <>
              {/* Current Week card */}
              <div className="relative bg-white border border-[#e2e4e8] rounded-2xl px-6 py-5 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00e5a0] rounded-l-full" />
                <div className="flex items-start justify-between gap-4 pl-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#00a870] mb-1">Current Week</div>
                    <div className="text-xl font-bold text-[#0d0d0f] leading-snug">{currentWeekRange()}</div>
                    {/* Day pills */}
                    <div className="flex items-center gap-1.5 mt-3">
                      {['Mon','Tue','Wed','Thu','Fri'].map((d, i) => {
                        const isToday = isWeekday && todayDow === i + 1
                        return (
                          <span key={d} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            isToday
                              ? 'bg-[#00e5a0] text-black'
                              : 'bg-[#f7f8fa] text-[#6b6b7a] border border-[#e2e4e8]'
                          }`}>{d}</span>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0 mt-1">
                    <a href={`/radio-planner/${showId}`}
                      className="bg-[#00e5a0] text-black font-bold rounded-xl px-5 py-2.5 text-sm hover:bg-[#00ffc0] transition-colors shadow-sm text-center">
                      Open Runsheet →
                    </a>
                    <a href={`/guests/${showId}`}
                      className="text-center text-xs text-[#6b6b7a] border border-[#e2e4e8] rounded-xl px-4 py-2 hover:text-[#0d0d0f] hover:border-[#c8cad0] transition-colors">
                      🎤 Guest Book
                    </a>
                  </div>
                </div>
              </div>

              {/* Today's Show grid */}
              <a href={`/radio-planner/${showId}`}
                className="block bg-white border border-[#e2e4e8] rounded-2xl overflow-hidden hover:border-[#00e5a0]/50 transition-colors group">
                {/* Header */}
                <div className="px-6 py-4 border-b border-[#e2e4e8]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-sm font-bold text-[#0d0d0f]">Today's Show</span>
                      <span className="text-xs text-[#6b6b7a] truncate">
                        {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </span>
                      {isWeekday && (
                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest bg-[#ff5c3a]/10 text-[#ff5c3a] border border-[#ff5c3a]/20 rounded-full px-2 py-0.5 flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ff5c3a] animate-pulse" />
                          On Air
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        filledCount === totalSlots ? 'bg-[#00e5a0]/15 text-[#00a870]' :
                        filledCount > 0 ? 'bg-[#f7f8fa] text-[#6b6b7a] border border-[#e2e4e8]' :
                        'bg-[#f7f8fa] text-[#c8cad0] border border-[#e2e4e8]'
                      }`}>{filledCount}/{totalSlots} planned</span>
                      <span className="text-xs text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 group-hover:text-[#0d0d0f] group-hover:border-[#c8cad0] transition-colors">
                        Open Planner →
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-1 bg-[#f0f1f3] rounded-full overflow-hidden">
                    <div className="h-full bg-[#00e5a0] rounded-full transition-all duration-500"
                      style={{ width: `${fillPct}%` }} />
                  </div>
                </div>

                {/* 3-column hour grid */}
                <div className="grid grid-cols-3 divide-x divide-[#e2e4e8]">
                  {HOURS.map(hour => {
                    const slots = [
                      { slotKey: '03',   time: ':03', label: 'Top of Hour' },
                      { slotKey: '10',   time: ':10', label: 'Segment' },
                      { slotKey: '20',   time: ':20', label: 'Segment' },
                      { slotKey: '33',   time: ':33', label: 'Half Hour Intro' },
                      { slotKey: '40',   time: ':40', label: 'Segment', isInterview: true },
                      { slotKey: '5055', time: ':55', label: 'Segment' },
                    ]
                    const hourFilled = slots.filter(s => todaySlots[`${hour}-${s.slotKey}`]?.title?.trim()).length
                    return (
                      <div key={hour}>
                        {/* Hour header */}
                        <div className="px-4 py-2.5 border-b border-[#e2e4e8] bg-[#f7f8fa] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#00e5a0] flex-shrink-0" />
                            <span className="text-xs font-bold text-[#0d0d0f]">{hour}:00 AM</span>
                          </div>
                          <span className="text-[10px] text-[#c8cad0]">{hourFilled}/{slots.length}</span>
                        </div>
                        {/* Slot rows */}
                        <div className="divide-y divide-[#f0f1f3]">
                          {slots.map(s => {
                            const slotData = todaySlots[`${hour}-${s.slotKey}`]
                            const title = slotData?.title || ''
                            const notes = slotData?.notes || ''
                            const filled = title.trim().length > 0
                            const notesPreview = notes ? notes.split('\n')[0].slice(0, 60) : ''
                            return (
                              <div key={s.slotKey}
                                className={`flex items-start gap-2.5 px-4 py-2.5 ${filled ? 'bg-[#f5fdf9]' : ''}`}>
                                <span className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-black transition-all mt-0.5 ${
                                  filled
                                    ? 'bg-[#00e5a0] text-black shadow-[0_0_0_2px_rgba(0,229,160,0.2)]'
                                    : 'border-2 border-[#e2e4e8]'
                                }`}>
                                  {filled ? '✓' : ''}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline gap-1.5">
                                    <span className={`text-[10px] font-mono flex-shrink-0 ${filled ? 'text-[#00a870]' : 'text-[#c8cad0]'}`}>
                                      {s.time}
                                    </span>
                                    <span className={`text-xs truncate ${filled ? 'text-[#0d0d0f] font-semibold' : 'text-[#c8cad0]'}`}>
                                      {filled ? title : s.label}
                                    </span>
                                  </div>
                                  {filled && notesPreview && (
                                    <p className="text-[10px] text-[#9a9aaa] truncate mt-0.5 leading-tight">{notesPreview}</p>
                                  )}
                                </div>
                                {(s as any).isInterview && !filled && (
                                  <span className="text-[9px] font-medium text-[#f59e0b] flex-shrink-0 mt-0.5">Guest</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </a>

              {/* Broadcast Archive */}
              <div className="bg-white border border-[#e2e4e8] rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e2e4e8] flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold">Broadcast Archive</span>
                    <span className="text-xs text-[#6b6b7a] ml-2">{radioWeeks.length} {radioWeeks.length === 1 ? 'week' : 'weeks'}</span>
                  </div>
                </div>
                {/* Search */}
                {radioWeeks.length > 0 && (
                  <div className="px-6 py-3 border-b border-[#e2e4e8] relative">
                    <span className="absolute left-9.5 top-1/2 -translate-y-1/2 text-[#c8cad0] text-sm pointer-events-none">🔍</span>
                    <input
                      type="text"
                      value={archiveSearch}
                      onChange={e => setArchiveSearch(e.target.value)}
                      placeholder="Search by month or year…"
                      className="w-full bg-[#f7f8fa] border border-[#e2e4e8] rounded-xl pl-8 pr-4 py-2 text-sm text-[#0d0d0f] outline-none focus:border-[#00e5a0] placeholder-[#c8cad0] transition-colors"
                    />
                    {archiveSearch && (
                      <button onClick={() => setArchiveSearch('')}
                        className="absolute right-9 top-1/2 -translate-y-1/2 text-[#c8cad0] hover:text-[#6b6b7a] text-lg leading-none">×</button>
                    )}
                  </div>
                )}
                {radioWeeks.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="text-3xl mb-3">📻</div>
                    <p className="text-[#6b6b7a] text-sm font-medium">No runsheets yet</p>
                    <p className="text-[#c8cad0] text-xs mt-1">Open the planner and start filling in segments.</p>
                  </div>
                ) : filteredWeeks.length === 0 ? (
                  <div className="px-6 py-10 text-center text-[#6b6b7a] text-sm">No weeks match "{archiveSearch}"</div>
                ) : (
                  <div className="divide-y divide-[#e2e4e8]">
                    {filteredWeeks.map((mondayStr, idx) => {
                      const mon = new Date(mondayStr + 'T00:00:00')
                      const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
                      const dateLabel = `${mon.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${fri.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      const isThisWeek = idx === 0 && !archiveSearch
                      return (
                        <a key={mondayStr} href={`/radio-planner/${showId}`}
                          className="flex items-center justify-between px-6 py-3.5 hover:bg-[#f7f8fa] transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-[#f7f8fa] border border-[#e2e4e8] flex items-center justify-center text-sm flex-shrink-0 group-hover:border-[#00e5a0]/40 transition-colors">
                              📻
                            </div>
                            <div>
                              <div className="font-medium text-sm text-[#0d0d0f] group-hover:text-[#00a870] transition-colors">
                                {dateLabel}
                              </div>
                              {isThisWeek && (
                                <div className="text-[10px] text-[#00a870] font-semibold mt-0.5">This week</div>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-all">
                            Open →
                          </span>
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )
        })()}

        {/* ── Podcast: Current Episode + Whiteboard + Archive ── */}
        {!isRadio && (
          <>
            {currentEp ? (
              <div className="relative bg-gradient-to-r from-[#edfdf6] to-white border border-[#00e5a0]/40 rounded-2xl px-6 py-5 flex items-center justify-between overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00e5a0] rounded-l-2xl" />
                <div className="pl-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#00a870]">Current Episode</div>
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
                  {sections.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-[#6b6b7a]">{completedSections}/{sections.length} sections complete</span>
                        <span className="text-[10px] font-semibold text-[#00a870]">{completionPct}%</span>
                      </div>
                      <div className="h-1.5 bg-[#e2e4e8] rounded-full overflow-hidden">
                        <div className="h-full bg-[#00e5a0] rounded-full transition-all duration-500" style={{ width: `${completionPct}%` }} />
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

            {/* Whiteboard */}
            {currentEp && sections.length > 0 && (
              <div className="rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
                style={{ border: '10px solid #2e2e2e', outline: '2px solid #3a3a3a' }}>
                <div className="h-3 flex items-center px-4 gap-1.5" style={{ background: '#252525' }}>
                  {['#555','#444','#333'].map((c, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                  ))}
                </div>
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
                          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ background: 'radial-gradient(circle at 35% 35%, #ff8c6a, #cc3a20)', border: '1.5px solid #aa2e18', boxShadow: '0 2px 6px rgba(0,0,0,0.35)' }}>
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.4)' }} />
                            </div>
                          </div>
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
                <div className="h-5" style={{ background: '#252525' }} />
              </div>
            )}

            {/* Episode Archive */}
            <div className="bg-white border border-[#e2e4e8] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#e2e4e8] flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold">Episode Archive</span>
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
                          title="Delete episode">×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </main>
  )
}
