'use client'
import { useEffect, useState, useMemo, use } from 'react'
import { supabase } from '../../../lib/supabase'
import Logo from '../../../components/Logo'
import { useShowAccess } from '../../../lib/useShowAccess'
import { formatEpisodeDate } from '../../../lib/dates'

export default function Archive({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = use(params)
  const access = useShowAccess(showId)
  const [episodes, setEpisodes] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const show = access.status === 'ready' ? access.show : null

  useEffect(() => {
    if (access.status !== 'ready') return
    let ignore = false
    ;(async () => {
      try {
        const { data, error } = await supabase.from('episodes').select('*')
          .eq('show_id', showId)
          .order('episode_date', { ascending: false })
          .order('id', { ascending: false })
        if (ignore) return
        if (error) { setLoadError(error.message); return }
        setEpisodes(data || [])
      } catch (e: any) {
        if (!ignore) setLoadError(e?.message || 'Failed to load episodes')
      } finally {
        if (!ignore) setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [access.status, showId])

  // Episode number + formatted date per episode, computed once from the FULL
  // list (numbers must not shift when the list is filtered by search).
  const episodeMeta = useMemo(() => {
    const start = (show?.episode_number_start ?? 1) - 1
    const map = new Map<string, { number: number; dateLabel: string }>()
    episodes.forEach((ep, i) => {
      map.set(ep.id, { number: start + (episodes.length - i), dateLabel: formatEpisodeDate(ep.episode_date) })
    })
    return map
  }, [episodes, show])

  const deleteEpisode = async (episodeId: string) => {
    setDeleteError(null)
    const fail = (msg: string) => setDeleteError(`Delete failed — ${msg}`)
    const { error: contentErr } = await supabase.from('section_content').delete().eq('episode_id', episodeId)
    if (contentErr) { fail(contentErr.message); return }
    const { error: linksErr } = await supabase.from('section_links').delete().eq('episode_id', episodeId)
    if (linksErr) { fail(linksErr.message); return }
    const { error: sectionsErr } = await supabase.from('sections').delete().eq('episode_id', episodeId)
    if (sectionsErr) { fail(sectionsErr.message); return }
    const { error: episodeErr } = await supabase.from('episodes').delete().eq('id', episodeId)
    if (episodeErr) { fail(episodeErr.message); return }
    setEpisodes(prev => prev.filter(e => e.id !== episodeId))
    setDeleteConfirm(null)
  }

  const filtered = episodes.filter(ep => {
    const q = search.toLowerCase()
    return !q || (ep.title || '').toLowerCase().includes(q) || (episodeMeta.get(ep.id)?.dateLabel || '').toLowerCase().includes(q)
  })

  if (access.status === 'error' || loadError) return (
    <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center px-6">
      <div className="bg-white border border-[#e2e4e8] rounded-2xl px-8 py-10 text-center max-w-sm w-full">
        <p className="font-semibold text-[#0d0d0f] mb-1">Something went wrong</p>
        <p className="text-sm text-[#6b6b7a] mb-5">{access.status === 'error' ? access.message : loadError}</p>
        <button onClick={() => window.location.reload()}
          className="bg-[#00e5a0] text-black font-bold rounded-xl px-6 py-2.5 text-sm hover:bg-[#00ffc0] transition-colors">
          Retry
        </button>
      </div>
    </div>
  )

  if (access.status === 'loading' || loading) return (
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
            + {show.show_type === 'radio' ? 'New Broadcast' : 'New Episode'}
          </a>
        )}
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          {show?.logo_url && <img src={show.logo_url} alt="logo" className="w-10 h-10 rounded-lg object-cover mb-3" />}
          <h1 className="text-2xl font-bold">{show?.name}</h1>
          <p className="text-[#6b6b7a] text-sm mt-1">
            {show?.show_type === 'radio' ? 'Broadcast Archive' : 'Episode Archive'} · {episodes.length} {show?.show_type === 'radio' ? `broadcast${episodes.length !== 1 ? 's' : ''}` : `episode${episodes.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="bg-white border border-[#e2e4e8] rounded-2xl overflow-hidden">
          {deleteError && (
            <div className="px-6 py-3 bg-[#fff1ee] border-b border-[#ffd0c4] text-[#ff5c3a] text-xs font-semibold flex items-center justify-between gap-3">
              <span>{deleteError}</span>
              <button onClick={() => setDeleteError(null)} className="text-[#ff5c3a] hover:text-[#ff3a1a] text-base leading-none flex-shrink-0" title="Dismiss">×</button>
            </div>
          )}
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
            <div className="px-6 py-14 text-center">
              <div className="text-4xl mb-3">🎙️</div>
              <p className="text-[#6b6b7a] text-sm mb-5">
                {search ? 'No episodes match your search.' : "No episodes yet. Create your first one!"}
              </p>
              {!search && (
                <a href={`/planner/${showId}?new=true`}
                  className="inline-block bg-[#00e5a0] text-black font-bold rounded-xl px-6 py-2.5 text-sm hover:bg-[#00ffc0] transition-colors">
                  + {show?.show_type === 'radio' ? 'New Broadcast' : 'New Episode'}
                </a>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#e2e4e8]">
              {filtered.map(ep => (
                <div key={ep.id} className="flex items-center justify-between px-6 py-4 hover:bg-[#f7f8fa] transition-colors group">
                  <a href={`/planner/${showId}?episodeId=${ep.id}`} className="flex-1 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-[#f7f8fa] border border-[#e2e4e8] flex items-center justify-center text-xs font-bold text-[#6b6b7a] flex-shrink-0">
                      {episodeMeta.get(ep.id)?.number}
                    </div>
                    <div>
                      <div className="font-semibold text-sm group-hover:text-[#00a870] transition-colors">{ep.title || 'Untitled Episode'}</div>
                      <div className="text-[#6b6b7a] text-xs mt-0.5">{episodeMeta.get(ep.id)?.dateLabel}</div>
                    </div>
                  </a>
                  <div className="flex items-center gap-3 opacity-100 sm:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all">
                    {deleteConfirm === ep.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#ff5c3a]">Delete?</span>
                        <button onClick={() => deleteEpisode(ep.id)} className="text-xs text-white bg-[#ff5c3a] rounded-lg px-2.5 py-1.5 hover:bg-[#ff3a1a] transition-colors">Yes</button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-xs text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-2.5 py-1.5 hover:border-[#c8cad0] transition-colors">No</button>
                      </div>
                    ) : (
                      <>
                        <a href={`/planner/${showId}?episodeId=${ep.id}`}
                          className="text-xs text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 hover:text-[#0d0d0f] transition-colors">
                          Open
                        </a>
                        <button onClick={() => setDeleteConfirm(ep.id)}
                          className="text-[#c8cad0] hover:text-[#ff5c3a] text-lg leading-none transition-all"
                          title="Delete episode">×</button>
                      </>
                    )}
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
