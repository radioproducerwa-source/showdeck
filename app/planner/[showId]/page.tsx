'use client'
import { useEffect, useState, use, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import Logo, { LogoIcon } from '../../../components/Logo'

const DEFAULT_SECTIONS = [
  { name: 'Show Intro', icon: '🎙️' },
  { name: 'News & Updates', icon: '📰' },
  { name: 'Main Topic', icon: '🎯' },
  { name: 'Guest / Interview', icon: '🎤' },
  { name: 'Listener Questions', icon: '❓' },
  { name: 'Picks & Recommendations', icon: '👍' },
  { name: 'Wrap Up', icon: '👋' },
]

const LOCKED_SECTIONS = new Set(["Last Week's Betting", 'AFL Multis'])

const IMPORT_MAP: Record<string, string> = {
  "Last Week's Betting": 'AFL Multis',
  'Racing Bets': 'Racing Bets',
}

export default function Planner({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = use(params)
  const [show, setShow] = useState<any>(null)
  const [sections, setSections] = useState<any[]>([])
  const [content, setContent] = useState<any>({})
  const [epTitle, setEpTitle] = useState('')
  const [episodeId, setEpisodeId] = useState<string | null>(null)
  const [episodeDate, setEpisodeDate] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [importing, setImporting] = useState<string | null>(null)
  const [addingSection, setAddingSection] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📝')
  const saveTimers = useRef<any>({})
  const titleTimer = useRef<any>(null)

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }

    const { data: showData } = await supabase.from('shows').select('*').eq('id', showId).single()
    setShow(showData)

    const searchParams = new URLSearchParams(window.location.search)
    const existingEpisodeId = searchParams.get('episodeId')
    let episode: any = null

    if (existingEpisodeId) {
      const { data } = await supabase.from('episodes').select('*').eq('id', existingEpisodeId).single()
      episode = data
    } else {
      const today = new Date().toLocaleDateString('en-CA')
      let { data: episodes } = await supabase.from('episodes').select('*').eq('show_id', showId).eq('episode_date', today)
      episode = episodes?.[0]
      if (!episode) {
        const { data: newEp } = await supabase.from('episodes').insert({ show_id: showId, title: '', episode_date: today }).select().single()
        episode = newEp
      }
    }

    if (episode) {
      setEpisodeId(episode.id)
      setEpisodeDate(episode.episode_date)
      setEpTitle(episode.title || '')

      let { data: existingSections } = await supabase.from('sections').select('*').eq('episode_id', episode.id)
      if (!existingSections || existingSections.length === 0) {
        // Copy sections from the most recent previous episode, or fall back to generic defaults
        const { data: prevEps } = await supabase.from('episodes').select('id').eq('show_id', showId).neq('id', episode.id).order('episode_date', { ascending: false }).limit(1)
        let sectionSource: { name: string; icon: string }[] = DEFAULT_SECTIONS
        if (prevEps && prevEps.length > 0) {
          const { data: prevSections } = await supabase.from('sections').select('name, icon').eq('episode_id', prevEps[0].id)
          if (prevSections && prevSections.length > 0) sectionSource = prevSections
        }
        const { data: inserted } = await supabase.from('sections').insert(sectionSource.map(s => ({ episode_id: episode.id, name: s.name, icon: s.icon }))).select()
        existingSections = inserted || []
      }
      setSections(existingSections)

      const { data: saved } = await supabase.from('section_content').select('*').eq('episode_id', episode.id)
      if (saved && saved.length > 0) {
        const map: any = {}
        saved.forEach((row: any) => { map[`${row.section_name}-${row.role}`] = row.content })
        setContent(map)
      }
    }
  }

  const removeSection = async (sectionId: string) => {
    await supabase.from('sections').delete().eq('id', sectionId)
    setSections(prev => prev.filter(s => s.id !== sectionId))
  }

  const addSection = async () => {
    if (!newName.trim() || !episodeId) return
    const { data } = await supabase.from('sections').insert({ episode_id: episodeId, name: newName.trim(), icon: newIcon }).select().single()
    if (data) setSections(prev => [...prev, data])
    setNewName(''); setNewIcon('📝'); setAddingSection(false)
  }

  const importFromLastWeek = async (sectionName: string) => {
    if (!episodeDate) return
    setImporting(sectionName)
    const sourceSectionName = IMPORT_MAP[sectionName]
    const { data: prevEpisodes } = await supabase.from('episodes').select('*').eq('show_id', showId).lt('episode_date', episodeDate).order('episode_date', { ascending: false }).limit(1)
    if (!prevEpisodes || prevEpisodes.length === 0) { alert('No previous episode found to import from.'); setImporting(null); return }
    const prevEpisode = prevEpisodes[0]
    const { data: prevContent } = await supabase.from('section_content').select('*').eq('episode_id', prevEpisode.id).eq('section_name', sourceSectionName)
    if (!prevContent || prevContent.length === 0) { alert(`No content found in "${sourceSectionName}" from the previous episode.`); setImporting(null); return }
    for (const row of prevContent) {
      await saveContent(sectionName, row.role, row.content)
      setContent((prev: any) => ({ ...prev, [`${sectionName}-${row.role}`]: row.content }))
    }
    setImporting(null); setSaveStatus('saved')
  }

  const updateTitle = (value: string) => {
    setEpTitle(value); setSaveStatus('unsaved')
    clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(async () => {
      if (!episodeId) return
      setSaveStatus('saving')
      const { error } = await supabase.from('episodes').update({ title: value }).eq('id', episodeId)
      setSaveStatus(error ? 'unsaved' : 'saved')
    }, 800)
  }

  const updateContent = (sectionName: string, role: string, value: string) => {
    setContent((prev: any) => ({ ...prev, [`${sectionName}-${role}`]: value }))
    setSaveStatus('unsaved')
    const key = `${sectionName}-${role}`
    clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = setTimeout(() => saveContent(sectionName, role, value), 800)
  }

  const saveContent = async (sectionName: string, role: string, value: string) => {
    if (!episodeId) return
    setSaveStatus('saving')
    const { error } = await supabase.from('section_content').upsert(
      { episode_id: episodeId, section_name: sectionName, role, content: value },
      { onConflict: 'episode_id,section_name,role' }
    )
    setSaveStatus(error ? 'unsaved' : 'saved')
  }

  const getContent = (sectionName: string, role: string) => content[`${sectionName}-${role}`] || ''

  const getStatus = (sectionName: string) => {
    const total = getContent(sectionName, 'host1').length + getContent(sectionName, 'host2').length
    if (total === 0) return { label: 'EMPTY', cls: 'text-[#6b6b7a] border-[#e2e4e8] bg-[#eeeef2]' }
    if (total < 20) return { label: 'DRAFT', cls: 'text-[#d49c00] border-[#f5c842]/40 bg-[#f5c842]/10' }
    return { label: 'READY', cls: 'text-[#00a870] border-[#00e5a0]/40 bg-[#00e5a0]/10' }
  }

  const exportRunsheet = () => {
    let text = `${show?.name?.toUpperCase()} — EPISODE RUNSHEET\n${'='.repeat(50)}\n${epTitle || 'Untitled Episode'}\n${'='.repeat(50)}\n\n`
    sections.forEach(s => {
      text += `${s.icon} ${s.name.toUpperCase()}\n${'─'.repeat(40)}\n`
      text += `${show?.host1_name}:\n${getContent(s.name, 'host1') || '—'}\n\n`
      text += `${show?.host2_name}:\n${getContent(s.name, 'host2') || '—'}\n\n`
    })
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'showdeck-runsheet.txt'
    a.click()
  }

  if (!show) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-[#6b6b7a]">Loading...</div>
    </div>
  )

  return (
    <main className="min-h-screen bg-white text-[#0d0d0f]">
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
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#6b6b7a]">
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : '● Unsaved'}
          </span>
          <button onClick={exportRunsheet} className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-4 py-1.5 text-sm hover:text-[#0d0d0f] transition-colors">
            Export Runsheet
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <input
          type="text" value={epTitle} onChange={e => updateTitle(e.target.value)}
          placeholder="EPISODE TITLE..."
          className="bg-transparent border-none text-3xl font-bold text-[#0d0d0f] tracking-widest outline-none w-full mb-8 placeholder-[#d1d5db]"
        />
        <div className="flex flex-col gap-4">
          {sections.map((section) => {
            const status = getStatus(section.name)
            const canImport = section.name in IMPORT_MAP
            const locked = LOCKED_SECTIONS.has(section.name)
            return (
              <div key={section.id} className="bg-[#f7f8fa] border border-[#e2e4e8] rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-[#eeeef2] border-b border-[#e2e4e8]">
                  <LogoIcon size={14} />
                  <span className="font-semibold text-sm flex-1">{section.name}</span>
                  {canImport && (
                    <button onClick={() => importFromLastWeek(section.name)} disabled={importing === section.name}
                      className="text-xs text-[#00a870] border border-[#00e5a0]/40 rounded-full px-3 py-0.5 hover:bg-[#00e5a0]/10 transition-colors disabled:opacity-50 mr-2">
                      {importing === section.name ? 'Importing...' : '↓ Import last week'}
                    </button>
                  )}
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${status.cls}`}>{status.label}</span>
                  {locked ? (
                    <span className="text-[#c8cad0] text-xs ml-2" title="This section is locked">🔒</span>
                  ) : (
                    <button onClick={() => removeSection(section.id)}
                      className="text-[#c8cad0] hover:text-[#ff5c3a] text-sm ml-2 transition-colors leading-none" title="Remove section">
                      ×
                    </button>
                  )}
                </div>
                <div className="divide-y divide-[#e2e4e8]">
                  {['host1', 'host2'].map((role) => {
                    const isHost1 = role === 'host1'
                    const name = isHost1 ? show.host1_name : show.host2_name
                    const color = isHost1 ? 'bg-[#00e5a0]' : 'bg-[#ff5c3a]'
                    const label = isHost1 ? 'Host 1' : 'Host 2'
                    return (
                      <div key={role} className="flex">
                        <div className="w-28 flex-shrink-0 px-3 py-3 bg-white border-r border-[#e2e4e8] flex items-start gap-2">
                          <div className={`w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mt-0.5`}>
                            {(isHost1 ? show.host1_avatar : show.host2_avatar)
                              ? <img src={isHost1 ? show.host1_avatar : show.host2_avatar} alt={name} className="w-full h-full object-cover" />
                              : <div className={`w-full h-full ${color} flex items-center justify-center text-black text-xs font-bold`}>{name?.[0]}</div>
                            }
                          </div>
                          <div>
                            <div className="text-xs font-semibold">{name}</div>
                            <div className="text-[10px] text-[#6b6b7a]">{label}</div>
                          </div>
                        </div>
                        <textarea value={getContent(section.name, role)} onChange={e => updateContent(section.name, role, e.target.value)}
                          placeholder="Your notes..."
                          className="flex-1 bg-transparent text-sm text-[#0d0d0f] px-4 py-3 outline-none resize-none min-h-[60px] placeholder-[#c8cad0]"
                          rows={2} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {addingSection ? (
            <div className="bg-[#f7f8fa] border border-[#e2e4e8] rounded-xl p-4 flex items-center gap-3">
              <input type="text" value={newIcon} onChange={e => setNewIcon(e.target.value)}
                className="w-12 bg-white border border-[#e2e4e8] rounded-lg text-center text-lg outline-none" maxLength={2} />
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addSection(); if (e.key === 'Escape') setAddingSection(false) }}
                placeholder="Section name..." autoFocus
                className="flex-1 bg-white border border-[#e2e4e8] rounded-lg px-3 py-2 text-sm text-[#0d0d0f] outline-none placeholder-[#c8cad0]" />
              <button onClick={addSection} className="bg-[#00e5a0] text-black font-bold rounded-lg px-4 py-2 text-sm hover:bg-[#00ffc0] transition-colors">Add</button>
              <button onClick={() => setAddingSection(false)} className="text-[#6b6b7a] hover:text-[#0d0d0f] text-sm transition-colors">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAddingSection(true)}
              className="border border-dashed border-[#e2e4e8] rounded-xl py-3 text-[#6b6b7a] text-sm hover:border-[#00e5a0] hover:text-[#00a870] transition-colors">
              + Add Section
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
