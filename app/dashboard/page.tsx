'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [shows, setShows] = useState<any[]>([])
  const [episodes, setEpisodes] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [search, setSearch] = useState<Record<string, string>>({})
  const [boardData, setBoardData] = useState<{ show: any, episode: any, sections: any[], content: Record<string, string> } | null>(null)
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
            s.forEach((show, i) => loadEpisodes(show.id, i === 0 ? show : undefined))
          })
      }
    })
  }, [])

  const loadEpisodes = async (showId: string, showData?: any) => {
    const { data } = await supabase.from('episodes').select('*').eq('show_id', showId).order('episode_date', { ascending: false }).order('id', { ascending: false })
    setEpisodes((prev: any) => ({ ...prev, [showId]: data || [] }))
    if (showData && data && data[0] && !boardData) {
      const ep = data[0]
      const [{ data: sections }, { data: contentRows }] = await Promise.all([
        supabase.from('sections').select('*').eq('episode_id', ep.id),
        supabase.from('section_content').select('*').eq('episode_id', ep.id)
      ])
      const contentMap: Record<string, string> = {}
      contentRows?.forEach((r: any) => { contentMap[`${r.section_name}-${r.role}`] = r.content })
      setBoardData({ show: showData, episode: ep, sections: sections || [], content: contentMap })
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  const deleteEpisode = async (showId: string, episodeId: string, title: string) => {
    if (!confirm(`Delete "${title || 'Untitled Episode'}"? This can't be undone.`)) return
    await supabase.from('section_content').delete().eq('episode_id', episodeId)
    await supabase.from('sections').delete().eq('episode_id', episodeId)
    await supabase.from('episodes').delete().eq('id', episodeId)
    setEpisodes((prev: any) => ({ ...prev, [showId]: prev[showId].filter((e: any) => e.id !== episodeId) }))
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

  if (!user) return <div className="min-h-screen bg-white"></div>

  return (
    <main className="min-h-screen bg-white text-[#0d0d0f] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <Logo size={0.9} />
          <div className="flex items-center gap-4">
            <span className="text-[#6b6b7a] text-sm">{user.email}</span>
            <button onClick={signOut} className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-4 py-2 text-sm hover:text-[#0d0d0f] transition-colors">Sign out</button>
          </div>
        </div>
        {/* Whiteboard */}
        {boardData && boardData.sections.length > 0 && (() => {
          const ROTATIONS = ['-rotate-1', 'rotate-2', '-rotate-2', 'rotate-1', 'rotate-0', 'rotate-2', '-rotate-1']
          const EMPTY_COLORS = ['#fef9c3', '#dbeafe', '#ede9fe', '#ffedd5', '#fce7f3', '#e0f2fe', '#fef3c7']
          const getBoardStatus = (sectionName: string) => {
            const c = boardData.content
            const total = (c[`${sectionName}-host1`] || '').length + (c[`${sectionName}-host2`] || '').length
            if (total === 0) return 'empty'
            if (total < 20) return 'draft'
            return 'ready'
          }
          const getPreview = (sectionName: string) => {
            const h1 = boardData.content[`${sectionName}-host1`] || ''
            const h2 = boardData.content[`${sectionName}-host2`] || ''
            return (h1 || h2).split('\n')[0].slice(0, 80) || null
          }
          const formatDate = (dateStr: string) => {
            if (!dateStr) return ''
            return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
          }
          return (
            <div className="mb-10 rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.18)]" style={{ border: '10px solid #2e2e2e', outline: '2px solid #444' }}>
              <div className="bg-[#252525] h-2.5" />
              <div className="bg-[#fafaf7] p-6"
                style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 39px, #ece8e0 39px, #ece8e0 40px)' }}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs text-[#b0a898] uppercase tracking-widest font-medium mb-0.5">{boardData.show.name}</p>
                    <h2 className="text-lg font-bold text-[#1a1a1a]" style={{ fontFamily: 'serif' }}>
                      {boardData.episode.title || 'Untitled Episode'}
                    </h2>
                    <p className="text-xs text-[#9a9080] mt-0.5">{formatDate(boardData.episode.episode_date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`/show/${boardData.show.id}`} className="text-[#9a9080] border border-[#d8d0c4] rounded-lg px-3 py-1.5 text-xs hover:text-[#1a1a1a] transition-colors">
                      Full View
                    </a>
                    <a href={`/planner/${boardData.show.id}?episodeId=${boardData.episode.id}`} className="bg-[#1a1a1a] text-white font-bold rounded-lg px-4 py-1.5 text-xs hover:bg-[#333] transition-colors">
                      Open Planner →
                    </a>
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-5">
                  {boardData.sections.map((section: any, i: number) => {
                    const status = getBoardStatus(section.name)
                    const preview = getPreview(section.name)
                    const rotation = ROTATIONS[i % ROTATIONS.length]
                    const bgColor = status === 'ready' ? '#d1fae5' : status === 'draft' ? '#fef3c7' : EMPTY_COLORS[i % EMPTY_COLORS.length]
                    return (
                      <a
                        key={section.id}
                        href={`/planner/${boardData.show.id}?episodeId=${boardData.episode.id}#${section.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                        className={`relative flex flex-col p-3 pt-6 shadow-[2px_3px_8px_rgba(0,0,0,0.12)] hover:shadow-[3px_5px_14px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 transition-all ${rotation}`}
                        style={{ backgroundColor: bgColor, minHeight: '110px' }}
                      >
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10">
                          <div className="w-4 h-4 rounded-full shadow flex items-center justify-center"
                            style={{ background: 'radial-gradient(circle at 35% 35%, #ff8c6a, #cc3a20)', border: '1.5px solid #aa2e18' }}>
                            <div className="w-1 h-1 rounded-full bg-white/40" />
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5 mb-1.5">
                          <span className="text-base leading-none mt-0.5">{section.icon}</span>
                          <span className="font-bold text-xs text-[#1a1a1a] leading-snug">{section.name}</span>
                        </div>
                        <p className="text-[10px] text-[#4a4040] leading-relaxed flex-1 line-clamp-2">
                          {preview || <span className="italic text-[#b0a898]">No notes</span>}
                        </p>
                        {status === 'ready' && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <span className="w-3.5 h-3.5 bg-[#00a870] rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">✓</span>
                            <span className="text-[9px] text-[#00a870] font-semibold uppercase tracking-wide">Ready</span>
                          </div>
                        )}
                        {status === 'draft' && (
                          <span className="mt-1.5 text-[9px] text-[#d49c00] font-semibold uppercase tracking-wide">Draft</span>
                        )}
                      </a>
                    )
                  })}
                </div>
              </div>
              <div className="bg-[#252525] h-4" />
            </div>
          )
        })()}

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Your Shows</h2>
          <a href="/create-show" className="bg-[#00e5a0] text-black font-bold rounded-lg px-5 py-2 text-sm hover:bg-[#00ffc0] transition-colors">+ New Show</a>
        </div>
        {loading ? (
          <div className="text-[#6b6b7a]">Loading...</div>
        ) : shows.length === 0 ? (
          <div className="bg-[#f7f8fa] border border-[#e2e4e8] rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">🎙️</div>
            <h2 className="text-xl font-bold mb-2">No shows yet</h2>
            <p className="text-[#6b6b7a] mb-6">Create your first show to get started</p>
            <a href="/create-show" className="bg-[#00e5a0] text-black font-bold rounded-xl px-8 py-3 hover:bg-[#00ffc0] transition-colors">Create Show</a>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {shows.map(show => (
              <div key={show.id} className="bg-[#f7f8fa] border border-[#e2e4e8] rounded-2xl overflow-hidden">
                <div className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-[#e2e4e8] bg-white flex items-center justify-center cursor-pointer hover:border-[#00e5a0] transition-colors group relative"
                      onClick={() => fileInputs.current[show.id]?.click()}
                      title="Upload logo"
                    >
                      {show.logo_url ? (
                        <img src={show.logo_url} alt="logo" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">🎙️</span>
                      )}
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{uploading === show.id ? '...' : '↑'}</span>
                      </div>
                      <input
                        ref={el => { fileInputs.current[show.id] = el }}
                        type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(show.id, f) }}
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">{show.name}</h3>
                      <div className="flex items-center gap-3">
                        {(['host1', 'host2'] as const).map(slot => {
                          const name = slot === 'host1' ? show.host1_name : show.host2_name
                          const avatar = slot === 'host1' ? show.host1_avatar : show.host2_avatar
                          const color = slot === 'host1' ? 'bg-[#00e5a0]' : 'bg-[#ff5c3a]'
                          const inputKey = `${show.id}-${slot}`
                          return (
                            <div key={slot} className="flex items-center gap-1.5 group/avatar cursor-pointer" onClick={() => fileInputs.current[inputKey]?.click()} title={`Upload ${name}'s photo`}>
                              <div className="relative w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                                {avatar
                                  ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
                                  : <div className={`w-full h-full ${color} flex items-center justify-center text-black text-xs font-bold`}>{name?.[0]}</div>
                                }
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-white text-[9px] font-bold">{uploading === inputKey ? '…' : '↑'}</span>
                                </div>
                              </div>
                              <span className="text-[#6b6b7a] text-sm">{name}</span>
                              <input ref={el => { fileInputs.current[inputKey] = el }} type="file" accept="image/*" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(show.id, slot, f) }} />
                            </div>
                          )
                        })}
                        {show.has_producer && (() => {
                          const inputKey = `${show.id}-producer`
                          return (
                            <div className="flex items-center gap-1.5 group/avatar cursor-pointer" onClick={() => fileInputs.current[inputKey]?.click()} title={`Upload ${show.producer_name}'s photo`}>
                              <div className="relative w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                                {show.producer_avatar
                                  ? <img src={show.producer_avatar} alt={show.producer_name} className="w-full h-full object-cover" />
                                  : <div className="w-full h-full bg-[#a78bfa] flex items-center justify-center text-black text-xs font-bold">{show.producer_name?.[0]}</div>
                                }
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-white text-[9px] font-bold">{uploading === inputKey ? '…' : '↑'}</span>
                                </div>
                              </div>
                              <span className="text-[#6b6b7a] text-sm">{show.producer_name}</span>
                              <input ref={el => { fileInputs.current[inputKey] = el }} type="file" accept="image/*" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(show.id, 'producer', f) }} />
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`/show-settings/${show.id}`} className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-4 py-2 text-sm hover:text-[#0d0d0f] transition-colors">Settings</a>
                    <a href={`/show/${show.id}`} className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-4 py-2 text-sm hover:text-[#0d0d0f] transition-colors">Whiteboard</a>
                    <a href={`/planner/${show.id}?new=true`} className="bg-[#00e5a0] text-black font-bold rounded-lg px-5 py-2 text-sm hover:bg-[#00ffc0] transition-colors">+ New Episode</a>
                  </div>
                </div>
                {episodes[show.id] && episodes[show.id].length > 0 && (
                  <div className="border-t border-[#e2e4e8]">
                    <div className="px-6 py-3 flex items-center justify-between">
                      <span className="text-xs text-[#6b6b7a] uppercase tracking-widest font-semibold">Episode Archive</span>
                      <input
                        type="text"
                        value={search[show.id] || ''}
                        onChange={e => setSearch(prev => ({ ...prev, [show.id]: e.target.value }))}
                        placeholder="Search episodes..."
                        className="bg-white border border-[#e2e4e8] rounded-lg px-3 py-1 text-xs text-[#0d0d0f] outline-none focus:border-[#00e5a0] w-48 placeholder-[#c8cad0]"
                      />
                    </div>
                    <div className="divide-y divide-[#e2e4e8]">
                      {episodes[show.id].filter((ep: any) => {
                        const q = (search[show.id] || '').toLowerCase()
                        return !q || (ep.title || '').toLowerCase().includes(q) || formatDate(ep.episode_date).toLowerCase().includes(q)
                      }).map((ep: any) => (
                        <div key={ep.id} className="flex items-center justify-between px-6 py-4 hover:bg-[#eeeef2] transition-colors group">
                          <a href={`/planner/${show.id}?episodeId=${ep.id}`} className="flex-1 flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-sm group-hover:text-[#00c988] transition-colors">{ep.title || 'Untitled Episode'}</div>
                              <div className="text-[#6b6b7a] text-xs mt-0.5">{formatDate(ep.episode_date)}</div>
                            </div>
                            <span className="text-[#c8cad0] group-hover:text-[#00c988] transition-colors mr-4">→</span>
                          </a>
                          <button
                            onClick={() => deleteEpisode(show.id, ep.id, ep.title)}
                            className="text-[#c8cad0] hover:text-[#ff5c3a] text-lg leading-none opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete episode"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {episodes[show.id] && episodes[show.id].length === 0 && (
                  <div className="border-t border-[#e2e4e8] px-6 py-4 text-[#6b6b7a] text-sm">No episodes yet — hit New Episode to start planning.</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
