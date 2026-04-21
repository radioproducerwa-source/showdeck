'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Logo from '../../../components/Logo'

export default function Archive({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = use(params)
  const [show, setShow] = useState<any>(null)
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
        setEpisodes(eps || [])
        setLoading(false)
      })
    })
  }, [])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  const deleteEpisode = async (episodeId: string, title: string) => {
    if (!confirm(`Delete "${title || 'Untitled Episode'}"? This can't be undone.`)) return
    await supabase.from('section_content').delete().eq('episode_id', episodeId)
    await supabase.from('sections').delete().eq('episode_id', episodeId)
    await supabase.from('episodes').delete().eq('id', episodeId)
    setEpisodes(prev => prev.filter(e => e.id !== episodeId))
  }

  const filtered = episodes.filter(ep => {
    const q = search.toLowerCase()
    return !q || (ep.title || '').toLowerCase().includes(q) || formatDate(ep.episode_date).toLowerCase().includes(q)
  })

  if (loading) return (
    <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center">
      <div className="text-[#6b6b7a]">Loading...</div>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#0d0d0f]">
      <header className="bg-white border-b border-[#e2e4e8] px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-[#6b6b7a] hover:text-[#0d0d0f] text-sm transition-colors">← Dashboard</a>
          <span className="text-[#e2e4e8]">|</span>
          <Logo size={0.65} />
        </div>
        {show && (
          <a href={`/planner/${showId}?new=true`} className="bg-[#00e5a0] text-black font-bold rounded-lg px-4 py-1.5 text-sm hover:bg-[#00ffc0] transition-colors">
            + New Episode
          </a>
        )}
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          {show?.logo_url && <img src={show.logo_url} alt="logo" className="w-10 h-10 rounded-lg object-cover mb-3" />}
          <h1 className="text-2xl font-bold">{show?.name}</h1>
          <p className="text-[#6b6b7a] text-sm mt-1">Episode Archive · {episodes.length} episode{episodes.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="bg-white border border-[#e2e4e8] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e2e4e8]">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title or date..."
              className="w-full bg-[#f7f8fa] border border-[#e2e4e8] rounded-lg px-4 py-2 text-sm text-[#0d0d0f] outline-none focus:border-[#00e5a0] placeholder-[#c8cad0]"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-10 text-center text-[#6b6b7a] text-sm">
              {search ? 'No episodes match your search.' : 'No episodes yet.'}
            </div>
          ) : (
            <div className="divide-y divide-[#e2e4e8]">
              {filtered.map((ep, i) => (
                <div key={ep.id} className="flex items-center justify-between px-6 py-4 hover:bg-[#f7f8fa] transition-colors group">
                  <a href={`/planner/${showId}?episodeId=${ep.id}`} className="flex-1 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-[#f7f8fa] border border-[#e2e4e8] flex items-center justify-center text-xs font-bold text-[#6b6b7a] flex-shrink-0">
                      {episodes.length - i}
                    </div>
                    <div>
                      <div className="font-semibold text-sm group-hover:text-[#00a870] transition-colors">{ep.title || 'Untitled Episode'}</div>
                      <div className="text-[#6b6b7a] text-xs mt-0.5">{formatDate(ep.episode_date)}</div>
                    </div>
                  </a>
                  <div className="flex items-center gap-3">
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
      </div>
    </main>
  )
}
