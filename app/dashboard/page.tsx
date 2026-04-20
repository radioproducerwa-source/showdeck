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
            s.forEach(show => loadEpisodes(show.id))
          })
      }
    })
  }, [])

  const loadEpisodes = async (showId: string) => {
    const { data } = await supabase.from('episodes').select('*').eq('show_id', showId).order('episode_date', { ascending: false })
    setEpisodes((prev: any) => ({ ...prev, [showId]: data || [] }))
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

  const uploadAvatar = async (showId: string, slot: 'host1' | 'host2', file: File) => {
    const key = `${showId}-${slot}`
    setUploading(key)
    const ext = file.name.split('.').pop()
    const path = `${showId}-${slot}.${ext}`
    const { error: uploadError } = await supabase.storage.from('show-logos').upload(path, file, { upsert: true })
    if (uploadError) { alert('Upload failed: ' + uploadError.message); setUploading(null); return }
    const { data: { publicUrl } } = supabase.storage.from('show-logos').getPublicUrl(path)
    const field = slot === 'host1' ? 'host1_avatar' : 'host2_avatar'
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
                        {show.has_producer && <span className="text-[#6b6b7a] text-sm">· {show.producer_name}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`/show/${show.id}`} className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-4 py-2 text-sm hover:text-[#0d0d0f] transition-colors">Whiteboard</a>
                    <a href={`/planner/${show.id}?new=true`} className="bg-[#00e5a0] text-black font-bold rounded-lg px-5 py-2 text-sm hover:bg-[#00ffc0] transition-colors">+ New Episode</a>
                  </div>
                </div>
                {episodes[show.id] && episodes[show.id].length > 0 && (
                  <div className="border-t border-[#e2e4e8]">
                    <div className="px-6 py-3 text-xs text-[#6b6b7a] uppercase tracking-widest font-semibold">Episode Archive</div>
                    <div className="divide-y divide-[#e2e4e8]">
                      {episodes[show.id].map((ep: any) => (
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
