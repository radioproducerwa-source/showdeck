'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Logo from '../../../components/Logo'

const NOTE_COLORS = ['#cdf0e3', '#f0e2cc']
const ROTATIONS = ['-rotate-1', 'rotate-1', '-rotate-1', 'rotate-1', '-rotate-1', 'rotate-1', '-rotate-1']

export default function Whiteboard({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = use(params)
  const [show, setShow] = useState<any>(null)
  const [episode, setEpisode] = useState<any>(null)
  const [sections, setSections] = useState<any[]>([])
  const [content, setContent] = useState<any>({})
  const router = useRouter()

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: showData } = await supabase.from('shows').select('*').eq('id', showId).single()
    setShow(showData)

    const { data: episodes } = await supabase
      .from('episodes').select('*').eq('show_id', showId)
      .order('episode_date', { ascending: false }).limit(1)

    const ep = episodes?.[0]
    if (!ep) return
    setEpisode(ep)

    const { data: sectionRows } = await supabase.from('sections').select('*').eq('episode_id', ep.id)
    setSections(sectionRows || [])

    const { data: saved } = await supabase.from('section_content').select('*').eq('episode_id', ep.id)
    if (saved) {
      const map: any = {}
      saved.forEach((row: any) => { map[`${row.section_name}-${row.role}`] = row.content })
      setContent(map)
    }
  }

  const getPreview = (sectionName: string) => {
    const h1 = content[`${sectionName}-host1`] || ''
    const h2 = content[`${sectionName}-host2`] || ''
    const text = h1 || h2
    return text.split('\n')[0].slice(0, 100) || null
  }

  const getStatus = (sectionName: string) => {
    const total = (content[`${sectionName}-host1`] || '').length + (content[`${sectionName}-host2`] || '').length
    if (total === 0) return 'empty'
    if (total < 20) return 'draft'
    return 'ready'
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  if (!show) return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
      <div className="text-white/40 text-sm">Loading...</div>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#1a1a1a] text-[#0d0d0f]">
      <header className="sticky top-0 z-10 bg-[#0d0d0f]/95 backdrop-blur border-b border-white/10 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-white/50 hover:text-white text-sm transition-colors">Back</a>
          <span className="text-white/20">|</span>
          <Logo size={0.55} />
          <span className="border-l border-white/10 pl-3 flex items-center gap-2">
            {show.logo_url && <img src={show.logo_url} alt="logo" className="w-6 h-6 rounded object-cover" />}
            <span className="text-white/50 text-xs">{show.name}</span>
          </span>
        </div>
        {episode && (
          <a
            href={`/planner/${showId}?episodeId=${episode.id}`}
            className="text-white/70 border border-white/20 rounded-lg px-4 py-1.5 text-sm hover:text-white hover:border-white/40 transition-colors"
          >
            Open Planner →
          </a>
        )}
      </header>

      <div className="p-6 md:p-10">
        {/* Whiteboard frame */}
        <div className="rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)]" style={{ border: '14px solid #2e2e2e', outline: '2px solid #444' }}>
          {/* Tray bar at bottom of frame */}
          <div className="bg-[#252525] h-3 flex items-center px-4 gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
          </div>

          {/* Whiteboard surface */}
          <div className="bg-[#fafaf7] min-h-[480px] p-8"
            style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 39px, #e8e4dc 39px, #e8e4dc 40px)' }}>

            {/* Episode heading */}
            <div className="flex items-start justify-between mb-10">
              <div>
                <p className="text-xs text-[#b0a898] uppercase tracking-widest font-medium mb-1">{show.name}</p>
                <h1 className="text-2xl font-bold text-[#1a1a1a] leading-tight" style={{ fontFamily: 'serif' }}>
                  {episode?.title || 'Untitled Episode'}
                </h1>
                {episode && <p className="text-[#9a9080] text-sm mt-1">{formatDate(episode.episode_date)}</p>}
              </div>
            </div>

            {sections.length === 0 ? (
              <div className="text-[#b0a898] text-sm italic">No sections found for this episode.</div>
            ) : (
              <div className="grid grid-cols-3 gap-8">
                {sections.map((section, i) => {
                  const status = getStatus(section.name)
                  const preview = getPreview(section.name)
                  const href = `/planner/${showId}?episodeId=${episode.id}#${section.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
                  const rotation = ROTATIONS[i % ROTATIONS.length]
                  const bgColor = NOTE_COLORS[i % 2]

                  return (
                    <a
                      key={section.id}
                      href={href}
                      className={`relative flex flex-col p-5 pt-8 shadow-[3px_4px_14px_rgba(0,0,0,0.13)] hover:shadow-[4px_7px_20px_rgba(0,0,0,0.18)] hover:-translate-y-1 transition-all ${rotation} cursor-pointer`}
                      style={{ backgroundColor: bgColor, minHeight: '160px' }}
                    >
                      {/* Pin */}
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                        <div className="w-5 h-5 rounded-full shadow-md flex items-center justify-center"
                          style={{ background: 'radial-gradient(circle at 35% 35%, #ff8c6a, #cc3a20)', border: '1.5px solid #aa2e18' }}>
                          <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                        </div>
                      </div>

                      {/* Section icon + name */}
                      <div className="flex items-start gap-2 mb-3">
                        <span className="text-lg leading-none mt-0.5 flex-shrink-0">{section.icon}</span>
                        <span className="font-bold text-sm text-[#1a1a1a] leading-snug">{section.name}</span>
                      </div>

                      {/* Preview */}
                      <p className="text-xs text-[#4a4040] leading-relaxed flex-1 line-clamp-4">
                        {preview || <span className="italic text-[#a89880]">No notes yet</span>}
                      </p>

                      {/* Ready tick */}
                      {status === 'ready' && (
                        <div className="mt-3 flex items-center gap-1.5">
                          <span className="w-4 h-4 bg-[#00a870] rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">✓</span>
                        </div>
                      )}
                    </a>
                  )
                })}
              </div>
            )}
          </div>

          {/* Bottom tray */}
          <div className="bg-[#252525] h-5" />
        </div>
      </div>
    </main>
  )
}
