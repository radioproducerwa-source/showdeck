'use client'
console.log('PLANNER PAGE LOADED')
'use client'
import { useEffect, useState, use } from 'react'
import { supabase } from '../../../lib/supabase'

const DEFAULT_SECTIONS = [
  { name: 'Show Intro', icon: '🎙️' },
  { name: 'Weekend Recap', icon: '📅' },
  { name: "Last Week's Betting", icon: '🎰' },
  { name: 'Hero of the Week', icon: '⭐' },
  { name: 'Next Round of AFL Games', icon: '🏉' },
  { name: 'AFL Multis', icon: '🎯' },
  { name: 'Racing', icon: '🐎' },
  { name: 'Racing Bets', icon: '💰' },
  { name: '$100 to $1000 Challenge', icon: '📈' },
]

export default function Planner({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = use(params)
  const [show, setShow] = useState<any>(null)
  const [content, setContent] = useState<any>({})
  const [epTitle, setEpTitle] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/'
      else {
        supabase.from('shows').select('*').eq('id', showId).single()
          .then(({ data: show }) => setShow(show))
      }
    })
  }, [])

  const updateContent = (sectionName: string, role: string, value: string) => {
    setContent((prev: any) => ({ ...prev, [`${sectionName}-${role}`]: value }))
  }

  const getContent = (sectionName: string, role: string) => {
    return content[`${sectionName}-${role}`] || ''
  }

  const getStatus = (sectionName: string) => {
    const total = getContent(sectionName, 'host1').length + getContent(sectionName, 'host2').length
    if (total === 0) return { label: 'EMPTY', cls: 'text-[#6b6b7a] border-[#2a2a32] bg-[#1c1c21]' }
    if (total < 20) return { label: 'DRAFT', cls: 'text-[#f5c842] border-[#f5c842]/30 bg-[#f5c842]/10' }
    return { label: 'READY', cls: 'text-[#00e5a0] border-[#00e5a0]/30 bg-[#00e5a0]/10' }
  }

  const exportRunsheet = () => {
    let text = `${show?.name?.toUpperCase()} — EPISODE RUNSHEET\n${'='.repeat(50)}\n${epTitle || 'Untitled Episode'}\n${'='.repeat(50)}\n\n`
    DEFAULT_SECTIONS.forEach(s => {
      text += `${s.icon} ${s.name.toUpperCase()}\n${'─'.repeat(40)}\n`
      text += `${show?.host1_name}:\n${getContent(s.name, 'host1') || '—'}\n\n`
      text += `${show?.host2_name}:\n${getContent(s.name, 'host2') || '—'}\n\n`
      if (show?.has_producer) text += `${show?.producer_name}:\n${getContent(s.name, 'producer') || '—'}\n\n`
    })
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'showdeck-runsheet.txt'
    a.click()
  }

  if (!mounted || !show) return (
    <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
      <div className="text-[#6b6b7a]">Loading...</div>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#0d0d0f] text-white">
      <header className="sticky top-0 z-10 bg-[#0d0d0f]/90 backdrop-blur border-b border-[#2a2a32] px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-[#6b6b7a] hover:text-white text-sm">Back</a>
          <span className="text-[#2a2a32]">|</span>
          <span className="text-[#00e5a0] font-bold tracking-widest text-sm">SHOWDECK</span>
          <span className="text-[#6b6b7a] text-xs border-l border-[#2a2a32] pl-3">{show.name}</span>
        </div>
        <button onClick={exportRunsheet} className="text-[#6b6b7a] border border-[#2a2a32] rounded-lg px-4 py-1.5 text-sm hover:text-white transition-colors">
          Export Runsheet
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <input
          type="text"
          value={epTitle}
          onChange={e => setEpTitle(e.target.value)}
          placeholder="EPISODE TITLE..."
          className="bg-transparent border-none text-3xl font-bold text-white tracking-widest outline-none w-full mb-8 placeholder-[#2a2a32]"
        />
        <div className="flex flex-col gap-4">
          {DEFAULT_SECTIONS.map((section) => {
            const status = getStatus(section.name)
            return (
              <div key={section.name} className="bg-[#141417] border border-[#2a2a32] rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-[#1c1c21] border-b border-[#2a2a32]">
                  <span>{section.icon}</span>
                  <span className="font-semibold text-sm flex-1">{section.name}</span>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${status.cls}`}>{status.label}</span>
                </div>
                <div className="divide-y divide-[#2a2a32]">
                  <div className="flex">
                    <div className="w-28 flex-shrink-0 px-3 py-3 bg-black/20 border-r border-[#2a2a32] flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#00e5a0] flex items-center justify-center text-black text-xs font-bold flex-shrink-0 mt-0.5">{show.host1_name?.[0]}</div>
                      <div>
                        <div className="text-xs font-semibold">{show.host1_name}</div>
                        <div className="text-[10px] text-[#6b6b7a]">Host 1</div>
                      </div>
                    </div>
                    <textarea
                      value={getContent(section.name, 'host1')}
                      onChange={e => updateContent(section.name, 'host1', e.target.value)}
                      placeholder="Your notes..."
                      className="flex-1 bg-transparent text-sm text-white px-4 py-3 outline-none resize-none min-h-[60px] placeholder-[#3a3a45]"
                      rows={2}
                    />
                  </div>
                  <div className="flex">
                    <div className="w-28 flex-shrink-0 px-3 py-3 bg-black/20 border-r border-[#2a2a32] flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#ff5c3a] flex items-center justify-center text-black text-xs font-bold flex-shrink-0 mt-0.5">{show.host2_name?.[0]}</div>
                      <div>
                        <div className="text-xs font-semibold">{show.host2_name}</div>
                        <div className="text-[10px] text-[#6b6b7a]">Host 2</div>
                      </div>
                    </div>
                    <textarea
                      value={getContent(section.name, 'host2')}
                      onChange={e => updateContent(section.name, 'host2', e.target.value)}
                      placeholder="Your notes..."
                      className="flex-1 bg-transparent text-sm text-white px-4 py-3 outline-none resize-none min-h-[60px] placeholder-[#3a3a45]"
                      rows={2}
                    />
                  </div>
                  {show.has_producer && (
                    <div className="flex">
                      <div className="w-28 flex-shrink-0 px-3 py-3 bg-black/20 border-r border-[#2a2a32] flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-[#a78bfa] flex items-center justify-center text-black text-xs font-bold flex-shrink-0 mt-0.5">{show.producer_name?.[0]}</div>
                        <div>
                          <div className="text-xs font-semibold">{show.producer_name}</div>
                          <div className="text-[10px] text-[#6b6b7a]">Producer</div>
                        </div>
                      </div>
                      <textarea
                        value={getContent(section.name, 'producer')}
                        onChange={e => updateContent(section.name, 'producer', e.target.value)}
                        placeholder="Producer notes..."
                        className="flex-1 bg-transparent text-sm text-white px-4 py-3 outline-none resize-none min-h-[60px] placeholder-[#3a3a45]"
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
