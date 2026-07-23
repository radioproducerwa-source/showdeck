'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { fetchAccessibleShows } from '../lib/shows'

type ShowResult = {
  id: string
  name: string
  show_type: string
  episodes: { id: string; title: string }[]
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [shows, setShows] = useState<ShowResult[]>([])
  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const inFlightRef = useRef(false)
  const router = useRouter()

  const loadShows = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setLoading(true)
    setLoadFailed(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setShows([]); return }
      const { all: showsData } = await fetchAccessibleShows(user.id)
      if (!showsData.length) { setShows([]); return }
      const ids = showsData.map((s: any) => s.id)
      const { data: eps, error: epsError } = await supabase
        .from('episodes').select('id, show_id, title')
        .in('show_id', ids).not('title', 'is', null).neq('title', '')
        .order('episode_date', { ascending: false })
      if (epsError) throw epsError
      const epsByShow: Record<string, { id: string; title: string }[]> = {}
      ;(eps || []).forEach((ep: any) => {
        if (!epsByShow[ep.show_id]) epsByShow[ep.show_id] = []
        if (ep.title) epsByShow[ep.show_id].push({ id: ep.id, title: ep.title })
      })
      setShows(showsData.map((s: any) => ({
        id: s.id,
        name: s.name,
        show_type: s.show_type,
        episodes: (epsByShow[s.id] || []).slice(0, 8),
      })))
    } catch {
      setLoadFailed(true)
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }, [])

  const openPalette = useCallback(() => {
    setQuery('')
    setActiveIndex(0)
    setOpen(true)
    loadShows()
  }, [loadShows])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (open) setOpen(false)
        else openPalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, openPalette])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 40)
    return () => clearTimeout(t)
  }, [open])

  const q = query.trim().toLowerCase()

  type ResultItem =
    | { kind: 'show'; show: ShowResult }
    | { kind: 'episode'; show: ShowResult; ep: { id: string; title: string } }

  const results: ResultItem[] = q
    ? shows.flatMap(show => {
        const items: ResultItem[] = []
        if (show.name.toLowerCase().includes(q)) items.push({ kind: 'show', show })
        show.episodes
          .filter(ep => ep.title.toLowerCase().includes(q))
          .forEach(ep => items.push({ kind: 'episode', show, ep }))
        return items
      })
    : shows.map(show => ({ kind: 'show', show }))

  const showTypeLabel = (t: string) =>
    t === 'breakfast_radio' ? '🌅' : t === 'drive' ? '🚗' : t === 'evening' ? '🌙' :
    t === 'radio' ? '📻' : '🎙️'

  const navigate = (href: string) => { setOpen(false); router.push(href) }

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => (results.length === 0 ? 0 : Math.min(i + 1, results.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = results[activeIndex]
      if (item) navigate(`/shows/${item.show.id}`)
    }
  }

  return (
    <>
      <button
        onClick={openPalette}
        title="Search (⌘K)"
        className="flex items-center gap-1.5 text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 text-xs hover:text-[#0d0d0f] hover:border-[#c8cad0] transition-colors"
      >
        <span>🔍</span>
        <span className="hidden sm:inline">Search</span>
        <span className="hidden sm:inline text-[10px] text-[#c8cad0] border border-[#e2e4e8] rounded px-1 py-px leading-none">⌘K</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
          style={{ background: 'rgba(13,13,15,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#e2e4e8]">
              <span className="text-[#c8cad0] text-base flex-shrink-0">🔍</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setActiveIndex(0) }}
                onKeyDown={onInputKeyDown}
                placeholder="Search shows and episodes…"
                className="flex-1 text-sm text-[#0d0d0f] outline-none placeholder-[#c8cad0] bg-transparent"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-[#c8cad0] hover:text-[#6b6b7a] text-xl leading-none flex-shrink-0">×</button>
              )}
              <kbd className="hidden sm:flex text-[10px] text-[#c8cad0] border border-[#e2e4e8] rounded px-1.5 py-0.5 leading-none flex-shrink-0">esc</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[52vh] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-8 text-center text-sm text-[#6b6b7a]">Loading…</div>
              ) : loadFailed ? (
                <div className="px-4 py-8 text-center text-sm text-[#6b6b7a]">
                  Couldn&apos;t load —{' '}
                  <button onClick={loadShows} className="text-[#00a870] font-semibold hover:underline">
                    try again
                  </button>
                </div>
              ) : results.length === 0 && q ? (
                <div className="px-4 py-8 text-center text-sm text-[#6b6b7a]">No results for "{query}"</div>
              ) : (
                <ul className="py-2">
                  {!q && results.length > 0 && (
                    <li className="px-4 pt-1 pb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#c8cad0]">Your Shows</span>
                    </li>
                  )}
                  {q && results.length > 0 && (
                    <li className="px-4 pt-1 pb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#c8cad0]">{results.length} result{results.length !== 1 ? 's' : ''}</span>
                    </li>
                  )}
                  {results.map((item, i) =>
                    item.kind === 'show' ? (
                      <li key={`show-${item.show.id}-${i}`}>
                        <button
                          onClick={() => navigate(`/shows/${item.show.id}`)}
                          onMouseEnter={() => setActiveIndex(i)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f7f8fa] transition-colors text-left ${i === activeIndex ? 'bg-[#f7f8fa]' : ''}`}
                        >
                          <span className="text-base w-6 text-center flex-shrink-0">{showTypeLabel(item.show.show_type)}</span>
                          <span className="text-sm font-semibold text-[#0d0d0f] truncate">{item.show.name}</span>
                          <span className="ml-auto text-[10px] text-[#c8cad0] flex-shrink-0">Show →</span>
                        </button>
                      </li>
                    ) : (
                      <li key={`ep-${item.ep.id}-${i}`}>
                        <button
                          onClick={() => navigate(`/shows/${item.show.id}`)}
                          onMouseEnter={() => setActiveIndex(i)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f7f8fa] transition-colors text-left ${i === activeIndex ? 'bg-[#f7f8fa]' : ''}`}
                        >
                          <span className="text-[#c8cad0] text-xs w-6 text-center flex-shrink-0">▸</span>
                          <div className="min-w-0">
                            <div className="text-sm text-[#0d0d0f] truncate">{item.ep.title}</div>
                            <div className="text-[10px] text-[#6b6b7a]">{item.show.name}</div>
                          </div>
                          <span className="ml-auto text-[10px] text-[#c8cad0] flex-shrink-0">Episode →</span>
                        </button>
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2.5 border-t border-[#e2e4e8] flex items-center justify-between">
              <span className="text-[10px] text-[#c8cad0]">Click a result to open</span>
              <Link href="/dashboard" onClick={() => setOpen(false)} className="text-[10px] text-[#6b6b7a] hover:text-[#0d0d0f] transition-colors">
                All shows →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
