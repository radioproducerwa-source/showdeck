'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Logo from '../../../components/Logo'

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
      .from('episodes')
      .select('*')
      .eq('show_id', showId)
      .order('episode_date', { ascending: false })
      .limit(1)

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

  const getFirstLine = (sectionName: string) => {
    const h1 = content[`${sectionName}-host1`] || ''
    const h2 = content[`${sectionName}-host2`] || ''
    const text = h1 || h2
    return text.split('\n')[0].slice(0, 80) || null
  }

  const getStatus = (sectionName: string) => {
    const total = (content[`${sectionName}-host1`] || '').length + (content[`${sectionName}-host2`] || '').length
    if (total === 0) return { label: 'EMPTY', cls: 'text-[#9ca3af] border-[#e2e4e8] bg-[#f3f4f6]' }
    if (total < 20) return { label: 'DRAFT', cls: 'text-[#d49c00] border-[#f5c842]/40 bg-[#fefce8]' }
    return { label: 'READY', cls: 'text-[#00a870] border-[#00e5a0]/40 bg-[#f0fdf4]' }
  }

  const sectionAnchor = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  if (!show) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-[#6b6b7a]">Loading...</div>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#0d0d0f]">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-[#e2e4e8] px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-[#6b6b7a] hover:text-[#0d0d0f] text-sm">Back</a>
          <span className="text-[#e2e4e8]">|</span>
          <Logo size={0.55} />
          <span className="border-l border-[#e2e4e8] pl-3 flex items-center gap-2">
            {show.logo_url && <img src={show.logo_url} alt="logo" className="w-6 h-6 rounded object-cover" />}
            <span className="text-[#6b6b7a] text-xs">{show.name}</span>
          </span>
        </div>
        {episode && (
          <a
            href={`/planner/${showId}?episodeId=${episode.id}`}
            className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-4 py-1.5 text-sm hover:text-[#0d0d0f] transition-colors"
          >
            Open Planner →
          </a>
        )}
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">{episode?.title || 'Untitled Episode'}</h1>
          {episode && <p className="text-[#6b6b7a] text-sm">{formatDate(episode.episode_date)}</p>}
        </div>

        {sections.length === 0 ? (
          <div className="text-[#6b6b7a] text-sm">No sections found for this episode.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map((section) => {
              const status = getStatus(section.name)
              const preview = getFirstLine(section.name)
              const href = `/planner/${showId}?episodeId=${episode.id}#${sectionAnchor(section.name)}`
              return (
                <a
                  key={section.id}
                  href={href}
                  className="bg-white border border-[#e2e4e8] rounded-xl p-4 flex flex-col gap-3 hover:border-[#00e5a0] hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{section.icon}</span>
                      <span className="font-semibold text-sm group-hover:text-[#00a870] transition-colors">{section.name}</span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex-shrink-0 ${status.cls}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-xs text-[#6b6b7a] leading-relaxed min-h-[2rem] line-clamp-2">
                    {preview || <span className="italic">No notes yet</span>}
                  </p>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
