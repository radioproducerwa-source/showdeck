'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [shows, setShows] = useState<any[]>([])
  const [episodes, setEpisodes] = useState<any>({})
  const [loading, setLoading] = useState(true)

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

  if (!user) return <div className="min-h-screen bg-[#0d0d0f]"></div>

  return (
    <main className="min-h-screen bg-[#0d0d0f] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <h1 className="text-4xl font-bold text-[#00e5a0] tracking-widest">SHOWDECK</h1>
          <div className="flex items-center gap-4">
            <span className="text-[#6b6b7a] text-sm">{user.email}</span>
            <button onClick={signOut} className="text-[#6b6b7a] border border-[#2a2a32] rounded-lg px-4 py-2 text-sm hover:text-white transition-colors">Sign out</button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Your Shows</h2>
          <a href="/create-show" className="bg-[#00e5a0] text-black font-bold rounded-lg px-5 py-2 text-sm hover:bg-[#00ffc0] transition-colors">+ New Show</a>
        </div>

        {loading ? (
          <div className="text-[#6b6b7a]">Loading...</div>
        ) : shows.length === 0 ? (
          <div className="bg-[#141417] border border-[#2a2a32] rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">🎙️</div>
            <h2 className="text-xl font-bold mb-2">No shows yet</h2>
            <p className="text-[#6b6b7a] mb-6">Create your first show to get started</p>
            <a href="/create-show" className="bg-[#00e5a0] text-black font-bold rounded-xl px-8 py-3 hover:bg-[#00ffc0] transition-colors">Create Show</a>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {shows.map(show => (
              <div key={show.id} className="bg-[#141417] border border-[#2a2a32] rounded-2xl overflow-hidden">
                <div className="p-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-1">{show.name}</h3>
                    <p className="text-[#6b6b7a] text-sm">{show.host1_name} & {show.host2_name}{show.has_producer ? ` · ${show.producer_name}` : ''}</p>
                  </div>
                  <a href={`/planner/${show.id}`} className="bg-[#00e5a0] text-black font-bold rounded-lg px-5 py-2 text-sm hover:bg-[#00ffc0] transition-colors">+ New Episode</a>
                </div>
                {episodes[show.id] && episodes[show.id].length > 0 && (
                  <div className="border-t border-[#2a2a32]">
                    <div className="px-6 py-3 text-xs text-[#6b6b7a] uppercase tracking-widest font-semibold">📺 Episode Archive</div>
                    <div className="divide-y divide-[#2a2a32]">
                      {episodes[show.id].map((ep: any) => (
                        <a key={ep.id} href={`/planner/${show.id}?episodeId=${ep.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-[#1c1c21] transition-colors group">
                          <div>
                            <div className="font-semibold text-sm group-hover:text-[#00e5a0] transition-colors">{ep.title || 'Untitled Episode'}</div>
                            <div className="text-[#6b6b7a] text-xs mt-0.5">{formatDate(ep.episode_date)}</div>
                          </div>
                          <span className="text-[#3a3a45] group-hover:text-[#00e5a0] transition-colors">→</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {episodes[show.id] && episodes[show.id].length === 0 && (
                  <div className="border-t border-[#2a2a32] px-6 py-4 text-[#6b6b7a] text-sm">No episodes yet — hit New Episode to start planning.</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
