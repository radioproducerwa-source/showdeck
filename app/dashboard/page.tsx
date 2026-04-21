'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

const NOTE_COLORS = ['#cdf0e3', '#f0e2cc']
const ROTATIONS = ['-rotate-1', 'rotate-1', '-rotate-1', 'rotate-1', '-rotate-1', 'rotate-1', '-rotate-1']

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [shows, setShows] = useState<any[]>([])
  const [currentEpisodes, setCurrentEpisodes] = useState<Record<string, any>>({})
  const [boardSections, setBoardSections] = useState<Record<string, any[]>>({})
  const [boardContent, setBoardContent] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/')
      else {
        setUser(data.user)
        supabase.from('shows').select('*').eq('owner_id', data.user.id)
          .then(({ data: shows }) => {
            const s = shows || []
            setShows(s)
            setLoading(false)
            s.forEach(show => loadShowData(show.id))
          })
      }
    })
  }, [])

  const loadShowData = async (showId: string) => {
    const { data: episodes } = await supabase.from('episodes').select('*')
      .eq('show_id', showId).order('episode_date', { ascending: false }).order('id', { ascending: false }).limit(1)
    const ep = episodes?.[0]
    if (!ep) return
    setCurrentEpisodes(prev => ({ ...prev, [showId]: ep }))
    const [{ data: sections }, { data: contentRows }] = await Promise.all([
      supabase.from('sections').select('*').eq('episode_id', ep.id),
      supabase.from('section_content').select('*').eq('episode_id', ep.id)
    ])
    const contentMap: Record<string, string> = {}
    contentRows?.forEach((r: any) => { contentMap[`${r.section_name}-${r.role}`] = r.content })
    setBoardSections(prev => ({ ...prev, [showId]: sections || [] }))
    setBoardContent(prev => ({ ...prev, [showId]: contentMap }))
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const getSectionStatus = (showId: string, sectionName: string) => {
    const c = boardContent[showId] || {}
    const total = (c[`${sectionName}-host1`] || '').length + (c[`${sectionName}-host2`] || '').length
    if (total === 0) return 'empty'
    if (total < 20) return 'draft'
    return 'ready'
  }

  const getSectionPreview = (showId: string, sectionName: string) => {
    const c = boardContent[showId] || {}
    const text = (c[`${sectionName}-host1`] || '') || (c[`${sectionName}-host2`] || '')
    return text.split('\n')[0].slice(0, 80) || null
  }

  const uploadLogo = async (showId: string, file: File) => {
    setUploading(showId)
    const ext = file.name.split('.').pop()
    const path = `${showId}.${ext}`
    const { error: uploadError } = await supabase.storage.from('show-logos').upload(path, file, { upsert: true })
    if (uploadError) { alert('Upload failed: ' + uploadError.message); setUploading(null); return }
    const { data: { publicUrl } } = supabase.storage.from('show-logos').getPublicUrl(path)
    await supabase.from('shows').update({ logo_url: publicUrl }).eq('id', showId)
    setShows(prev => prev.map(s => s.id === showId ? { ...s, logo_url: publicUrl } : s))
    setUploading(null)
  }

  const uploadAvatar = async (showId: string, slot: 'host1' | 'host2' | 'producer', file: File) => {
    const key = `${showId}-${slot}`
    setUploading(key)
    const ext = file.name.split('.').pop()
    const path = `${showId}-${slot}.${ext}`
    const { error: uploadError } = await supabase.storage.from('show-logos').upload(path, file, { upsert: true })
    if (uploadError) { alert('Upload failed: ' + uploadError.message); setUploading(null); return }
    const { data: { publicUrl } } = supabase.storage.from('show-logos').getPublicUrl(path)
    const field = slot === 'host1' ? 'host1_avatar' : slot === 'host2' ? 'host2_avatar' : 'producer_avatar'
    await supabase.from('shows').update({ [field]: publicUrl }).eq('id', showId)
    setShows(prev => prev.map(s => s.id === showId ? { ...s, [field]: publicUrl } : s))
    setUploading(null)
  }

  if (!user) return <div className="min-h-screen bg-white" />

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#0d0d0f]">

      {/* Nav */}
      <header className="bg-white border-b border-[#e2e4e8] px-8 h-14 flex items-center justify-between">
        <Logo size={0.75} />
        <div className="flex items-center gap-4">
          <span className="text-[#6b6b7a] text-sm hidden sm:block">{user.email}</span>
          <a href="/create-show" className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-4 py-1.5 text-sm hover:text-[#0d0d0f] transition-colors">+ New Show</a>
          <button onClick={signOut} className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-4 py-1.5 text-sm hover:text-[#0d0d0f] transition-colors">Sign out</button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-[#6b6b7a]">Loading...</div>
      ) : shows.length === 0 ? (
        <div className="max-w-lg mx-auto mt-24 bg-white border border-[#e2e4e8] rounded-2xl p-10 text-center">
          <div className="text-4xl mb-4">🎙️</div>
          <h2 className="text-xl font-bold mb-2">No shows yet</h2>
          <p className="text-[#6b6b7a] mb-6">Create your first show to get started</p>
          <a href="/create-show" className="bg-[#00e5a0] text-black font-bold rounded-xl px-8 py-3 hover:bg-[#00ffc0] transition-colors">Create Show</a>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-12">
          {shows.map(show => {
            const currentEp = currentEpisodes[show.id]
            const sections = boardSections[show.id] || []

            return (
              <div key={show.id}>

                {/* ── Show Info ── */}
                <div className="bg-white border border-[#e2e4e8] rounded-2xl p-6 mb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-bold mb-3">{show.name}</h1>
                      {/* Contributors row: logo + avatars */}
                      <div className="flex flex-wrap items-center gap-4">
                        {/* Logo */}
                        <div
                          className="relative w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 border border-[#e2e4e8] bg-[#f7f8fa] flex items-center justify-center cursor-pointer hover:border-[#00e5a0] transition-colors group"
                          onClick={() => fileInputs.current[show.id]?.click()}
                          title="Upload logo"
                        >
                          {show.logo_url
                            ? <img src={show.logo_url} alt="logo" className="w-full h-full object-cover" />
                            : <span className="text-base">🎙️</span>}
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-[9px] font-bold">{uploading === show.id ? '...' : '↑'}</span>
                          </div>
                          <input ref={el => { fileInputs.current[show.id] = el }} type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(show.id, f) }} />
                        </div>
                          {(['host1', 'host2'] as const).map(slot => {
                            const name = slot === 'host1' ? show.host1_name : show.host2_name
                            const avatar = slot === 'host1' ? show.host1_avatar : show.host2_avatar
                            const color = slot === 'host1' ? 'bg-[#00e5a0]' : 'bg-[#ff5c3a]'
                            const label = slot === 'host1' ? 'Host 1' : 'Host 2'
                            const inputKey = `${show.id}-${slot}`
                            return (
                              <div key={slot} className="flex items-center gap-2 group/av cursor-pointer" onClick={() => fileInputs.current[inputKey]?.click()} title={`Upload ${name}'s photo`}>
                                <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                                  {avatar
                                    ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
                                    : <div className={`w-full h-full ${color} flex items-center justify-center text-black text-sm font-bold`}>{name?.[0]}</div>}
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white text-[9px] font-bold">{uploading === inputKey ? '…' : '↑'}</span>
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm font-semibold leading-tight">{name}</div>
                                  <div className="text-[10px] text-[#6b6b7a]">{label}</div>
                                </div>
                                <input ref={el => { fileInputs.current[inputKey] = el }} type="file" accept="image/*" className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(show.id, slot, f) }} />
                              </div>
                            )
                          })}
                          {show.has_producer && (() => {
                            const inputKey = `${show.id}-producer`
                            return (
                              <div className="flex items-center gap-2 group/av cursor-pointer" onClick={() => fileInputs.current[inputKey]?.click()} title={`Upload ${show.producer_name}'s photo`}>
                                <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                                  {show.producer_avatar
                                    ? <img src={show.producer_avatar} alt={show.producer_name} className="w-full h-full object-cover" />
                                    : <div className="w-full h-full bg-[#a78bfa] flex items-center justify-center text-black text-sm font-bold">{show.producer_name?.[0]}</div>}
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white text-[9px] font-bold">{uploading === inputKey ? '…' : '↑'}</span>
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm font-semibold leading-tight">{show.producer_name}</div>
                                  <div className="text-[10px] text-[#6b6b7a]">Producer</div>
                                </div>
                                <input ref={el => { fileInputs.current[inputKey] = el }} type="file" accept="image/*" className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(show.id, 'producer', f) }} />
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a href={`/show-settings/${show.id}`} className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-2 text-sm hover:text-[#0d0d0f] transition-colors">Settings</a>
                      <a href={`/planner/${show.id}?new=true`} className="bg-[#00e5a0] text-black font-bold rounded-lg px-4 py-2 text-sm hover:bg-[#00ffc0] transition-colors">+ New Episode</a>
                    </div>
                  </div>
                </div>


                {/* ── Current Episode ── */}
                {currentEp ? (
                  <div className="bg-white border border-[#e2e4e8] rounded-2xl px-6 py-5 mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#00a870] mb-1">Current Episode</div>
                      <div className="text-xl font-bold">{currentEp.title || 'Untitled Episode'}</div>
                      <div className="text-sm text-[#6b6b7a] mt-0.5">{formatDate(currentEp.episode_date)}</div>
                    </div>
                    <a href={`/planner/${show.id}?episodeId=${currentEp.id}`}
                      className="bg-[#00e5a0] text-black font-bold rounded-xl px-6 py-3 text-sm hover:bg-[#00ffc0] transition-colors flex-shrink-0">
                      Open Planner →
                    </a>
                  </div>
                ) : (
                  <div className="bg-white border border-[#e2e4e8] rounded-2xl px-6 py-5 mb-4 flex items-center justify-between">
                    <span className="text-[#6b6b7a] text-sm">No episodes yet</span>
                    <a href={`/planner/${show.id}?new=true`} className="bg-[#00e5a0] text-black font-bold rounded-lg px-5 py-2 text-sm hover:bg-[#00ffc0] transition-colors">+ New Episode</a>
                  </div>
                )}

                {/* ── Whiteboard ── */}
                {currentEp && sections.length > 0 && (
                  <div className="mb-4 rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.18)]" style={{ border: '10px solid #2e2e2e', outline: '2px solid #444' }}>
                    <div className="bg-[#252525] h-2.5" />
                    <div className="bg-[#fafaf7] p-6"
                      style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 39px, #ece8e0 39px, #ece8e0 40px)' }}>
                      <div className="flex items-center justify-between mb-6">
                        <p className="text-xs text-[#b0a898] uppercase tracking-widest font-medium">{show.name} Whiteboard</p>
                        <a href={`/show/${show.id}`} className="text-[#9a9080] border border-[#d8d0c4] rounded-lg px-3 py-1.5 text-xs hover:text-[#1a1a1a] transition-colors">
                          Full Whiteboard →
                        </a>
                      </div>
                      <div className="grid grid-cols-3 gap-6">
                        {sections.map((section: any, i: number) => {
                          const status = getSectionStatus(show.id, section.name)
                          const preview = getSectionPreview(show.id, section.name)
                          const rotation = ROTATIONS[i % ROTATIONS.length]
                          const bgColor = NOTE_COLORS[i % 2]
                          return (
                            <a key={section.id}
                              href={`/planner/${show.id}?episodeId=${currentEp.id}#${section.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                              className={`relative flex flex-col p-4 pt-7 shadow-[2px_3px_10px_rgba(0,0,0,0.12)] hover:shadow-[3px_5px_16px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 transition-all ${rotation}`}
                              style={{ backgroundColor: bgColor, minHeight: '120px' }}>
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
                                <div className="w-4 h-4 rounded-full shadow flex items-center justify-center"
                                  style={{ background: 'radial-gradient(circle at 35% 35%, #ff8c6a, #cc3a20)', border: '1.5px solid #aa2e18' }}>
                                  <div className="w-1 h-1 rounded-full bg-white/40" />
                                </div>
                              </div>
                              <p className="text-[8px] font-bold uppercase tracking-widest text-[#a89880] mb-1.5">Section {i + 1}</p>
                              <div className="flex items-start gap-1.5 mb-2">
                                <span className="text-sm leading-none mt-0.5 flex-shrink-0">{section.icon}</span>
                                <span className="font-bold text-xs text-[#1a1a1a] leading-snug">{section.name}</span>
                              </div>
                              <p className="text-[10px] text-[#4a4040] leading-relaxed flex-1 line-clamp-3">
                                {preview || <span className="italic text-[#a89880]">No notes</span>}
                              </p>
                              {status === 'ready' && (
                                <div className="mt-2">
                                  <span className="w-3.5 h-3.5 bg-[#00a870] rounded-full flex items-center justify-center text-white text-[8px] font-bold inline-flex">✓</span>
                                </div>
                              )}
                            </a>
                          )
                        })}
                      </div>
                    </div>
                    <div className="bg-[#252525] h-4" />
                  </div>
                )}

                {/* ── Episode Archive link ── */}
                <a href={`/archive/${show.id}`}
                  className="flex items-center justify-between bg-white border border-[#e2e4e8] rounded-2xl px-6 py-4 hover:border-[#00e5a0] hover:bg-[#f7fffe] transition-colors group">
                  <div>
                    <div className="text-sm font-semibold group-hover:text-[#00a870] transition-colors">Episode Archive</div>
                    <div className="text-xs text-[#6b6b7a] mt-0.5">Browse and open past episodes</div>
                  </div>
                  <span className="text-[#c8cad0] group-hover:text-[#00a870] transition-colors text-lg">→</span>
                </a>

              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
