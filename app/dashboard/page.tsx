'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [shows, setShows] = useState<any[]>([])
  const [episodes, setEpisodes] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/'
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
    window.location.href = '/'
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
                      <h3 className="text-xl font-bold mb-1">{show.name}</h3>
                      <p className="text-[#6b6b7a] text-sm">{show.host1_name} & {show.host2_name}{show.has_producer ? ` · ${show.producer_name}` : ''}</p>
                    </div>
                  </div>
                  <a href={`/planner/${show.id}`} className="bg-[#00e5a0] text-black font-bold rounded-lg px-5 py-2 text-sm hover:bg-[#00ffc0] transition-colors">+ New Episode</a>
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
