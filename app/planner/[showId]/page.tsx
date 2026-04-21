'use client'
import { useEffect, useState, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Logo, { LogoIcon } from '../../../components/Logo'

const DEFAULT_SECTIONS = [
  { name: 'Introduction', icon: '🎙️' },
  { name: 'Main Topic', icon: '📋' },
  { name: 'Interview / Guest', icon: '🎤' },
  { name: 'Listener Questions', icon: '💬' },
  { name: 'News & Updates', icon: '📰' },
  { name: 'Wrap Up', icon: '👋' },
]

const LOCKED_SECTIONS = new Set(["Last Week's Betting", 'AFL Multis'])

const IMPORT_MAP: Record<string, string[]> = {
  "Last Week's Betting": ['AFL Multis', 'Racing Bets'],
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
  const [addingSection, setAddingSection] = useState<boolean | 'saving'>(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📝')
  const [links, setLinks] = useState<Record<string, { id: string; url: string }[]>>({})
  const [addingLink, setAddingLink] = useState<Record<string, boolean>>({})
  const [linkInput, setLinkInput] = useState<Record<string, string>>({})
  const saveTimers = useRef<any>({})
  const titleTimer = useRef<any>(null)
  const router = useRouter()

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: showData } = await supabase.from('shows').select('*').eq('id', showId).single()
    setShow(showData)

    const searchParams = new URLSearchParams(window.location.search)
    const existingEpisodeId = searchParams.get('episodeId')
    const forceNew = searchParams.get('new') === 'true'
    let episode: any = null

    if (existingEpisodeId) {
      const { data } = await supabase.from('episodes').select('*').eq('id', existingEpisodeId).single()
      episode = data
    } else if (forceNew) {
      const today = new Date().toLocaleDateString('en-CA')
      const { data: newEp } = await supabase.from('episodes').insert({ show_id: showId, title: '', episode_date: today }).select().single()
      episode = newEp
      window.history.replaceState({}, '', `/planner/${showId}?episodeId=${newEp?.id}`)
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

      const [{ data: saved }, { data: savedLinks }] = await Promise.all([
        supabase.from('section_content').select('*').eq('episode_id', episode.id),
        supabase.from('section_links').select('*').eq('episode_id', episode.id)
      ])
      if (saved && saved.length > 0) {
        const map: any = {}
        saved.forEach((row: any) => { map[`${row.section_name}-${row.role}`] = row.content })
        setContent(map)
      }
      if (savedLinks && savedLinks.length > 0) {
        const map: Record<string, { id: string; url: string }[]> = {}
        savedLinks.forEach((l: any) => {
          if (!map[l.section_name]) map[l.section_name] = []
          map[l.section_name].push({ id: l.id, url: l.url })
        })
        setLinks(map)
      }
    }
  }

  const removeSection = async (sectionId: string, sectionName: string) => {
    if (episodeId) await supabase.from('section_links').delete().eq('episode_id', episodeId).eq('section_name', sectionName)
    await supabase.from('sections').delete().eq('id', sectionId)
    setSections(prev => prev.filter(s => s.id !== sectionId))
    setLinks(prev => { const n = { ...prev }; delete n[sectionName]; return n })
  }

  const addLink = async (sectionName: string) => {
    const raw = (linkInput[sectionName] || '').trim()
    if (!raw || !episodeId) return
    const url = raw.startsWith('http') ? raw : `https://${raw}`
    const { data } = await supabase.from('section_links').insert({ episode_id: episodeId, section_name: sectionName, url }).select().single()
    if (data) {
      setLinks(prev => ({ ...prev, [sectionName]: [...(prev[sectionName] || []), { id: data.id, url: data.url }] }))
      setLinkInput(prev => ({ ...prev, [sectionName]: '' }))
      setAddingLink(prev => ({ ...prev, [sectionName]: false }))
    }
  }

  const removeLink = async (linkId: string, sectionName: string) => {
    await supabase.from('section_links').delete().eq('id', linkId)
    setLinks(prev => ({ ...prev, [sectionName]: (prev[sectionName] || []).filter(l => l.id !== linkId) }))
  }

  const getDomain = (url: string) => {
    try { return new URL(url).hostname.replace('www.', '') }
    catch { return url.slice(0, 30) }
  }

  const addSection = async () => {
    if (!newName.trim() || !episodeId) return
    setAddingSection('saving')
    const { data } = await supabase.from('sections').insert({ episode_id: episodeId, name: newName.trim(), icon: newIcon }).select().single()
    if (data) setSections(prev => [...prev, data])
    setNewName(''); setNewIcon('📝'); setAddingSection(false)
  }

  const importFromLastWeek = async (sectionName: string) => {
    if (!episodeDate) return
    setImporting(sectionName)
    const sourceSections = IMPORT_MAP[sectionName]
    const { data: prevEpisodes } = await supabase.from('episodes').select('*').eq('show_id', showId).lt('episode_date', episodeDate).order('episode_date', { ascending: false }).limit(1)
    if (!prevEpisodes || prevEpisodes.length === 0) { alert('No previous episode found to import from.'); setImporting(null); return }
    const prevEpisode = prevEpisodes[0]
    const { data: prevContent } = await supabase.from('section_content').select('*').eq('episode_id', prevEpisode.id).in('section_name', sourceSections)
    if (!prevContent || prevContent.length === 0) { alert('No bet content found in the previous episode.'); setImporting(null); return }

    // Combine content from all source sections per role, in order
    const combined: Record<string, string> = {}
    for (const source of sourceSections) {
      for (const role of ['host1', 'host2']) {
        const row = prevContent.find(r => r.section_name === source && r.role === role)
        if (row?.content) {
          const label = `${source}:\n${row.content}`
          combined[role] = combined[role] ? `${combined[role]}\n\n${label}` : label
        }
      }
    }

    for (const [role, text] of Object.entries(combined)) {
      await saveContent(sectionName, role, text)
      setContent((prev: any) => ({ ...prev, [`${sectionName}-${role}`]: text }))
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
    const total = getContent(sectionName, 'host1').length + getContent(sectionName, 'host2').length + getContent(sectionName, 'producer').length
    if (total === 0) return { label: 'EMPTY', cls: 'text-[#6b6b7a] border-[#e2e4e8] bg-[#eeeef2]' }
    if (total < 20) return { label: 'DRAFT', cls: 'text-[#d49c00] border-[#f5c842]/40 bg-[#f5c842]/10' }
    return { label: 'READY', cls: 'text-[#00a870] border-[#00e5a0]/40 bg-[#00e5a0]/10' }
  }

  const socialHandles = () => {
    const platforms = [
      { key: 'instagram', label: 'Instagram' },
      { key: 'tiktok',    label: 'TikTok' },
      { key: 'facebook',  label: 'Facebook' },
      { key: 'x_twitter', label: 'X' },
      { key: 'youtube',   label: 'YouTube' },
    ]
    return platforms.filter(p => show?.[p.key]).map(p => `${p.label}: ${show[p.key]}`).join('  ·  ')
  }

  const exportRunsheet = (format: 'txt' | 'md' = 'txt') => {
    const slug = (epTitle || 'runsheet').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const socials = socialHandles()
    if (format === 'md') {
      let md = `# ${show?.name} — ${epTitle || 'Untitled Episode'}\n\n`
      if (socials) md += `${socials}\n\n`
      sections.forEach(s => {
        md += `## ${s.icon} ${s.name}\n\n`
        md += `**${show?.host1_name}**\n${getContent(s.name, 'host1') || '*No notes*'}\n\n`
        md += `**${show?.host2_name}**\n${getContent(s.name, 'host2') || '*No notes*'}\n\n`
        if (show?.has_producer) md += `**${show?.producer_name} (Producer)**\n${getContent(s.name, 'producer') || '*No notes*'}\n\n`
        if ((links[s.name] || []).length > 0) md += `🔗 **Weblink attached** ✓\n\n`
      })
      const blob = new Blob([md], { type: 'text/markdown' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${slug}.md`
      a.click()
    } else {
      let text = `${show?.name?.toUpperCase()} — EPISODE RUNSHEET\n${'='.repeat(50)}\n${epTitle || 'Untitled Episode'}\n`
      if (socials) text += `${socials}\n`
      text += `${'='.repeat(50)}\n\n`
      sections.forEach(s => {
        text += `${s.icon} ${s.name.toUpperCase()}\n${'─'.repeat(40)}\n`
        text += `${show?.host1_name}:\n${getContent(s.name, 'host1') || '—'}\n\n`
        text += `${show?.host2_name}:\n${getContent(s.name, 'host2') || '—'}\n\n`
        if (show?.has_producer) text += `${show?.producer_name} (Producer):\n${getContent(s.name, 'producer') || '—'}\n\n`
        if ((links[s.name] || []).length > 0) text += `🔗 Weblink attached ✓\n\n`
      })
      const blob = new Blob([text], { type: 'text/plain' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${slug}.txt`
      a.click()
    }
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
          <div className="flex items-center gap-1">
            <button onClick={() => exportRunsheet('txt')} className="text-[#6b6b7a] border border-[#e2e4e8] rounded-l-lg px-3 py-1.5 text-sm hover:text-[#0d0d0f] transition-colors border-r-0">
              Export .txt
            </button>
            <button onClick={() => exportRunsheet('md')} className="text-[#6b6b7a] border border-[#e2e4e8] rounded-r-lg px-3 py-1.5 text-sm hover:text-[#0d0d0f] transition-colors">
              .md
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <input
          type="text" value={epTitle} onChange={e => updateTitle(e.target.value)}
          placeholder="EPISODE TITLE..."
          className="bg-transparent border-none text-3xl font-bold text-[#0d0d0f] tracking-widest outline-none w-full mb-3 placeholder-[#d1d5db]"
        />
        {(() => {
          const platforms = [
            { key: 'instagram', label: 'Instagram', color: '#E1306C' },
            { key: 'tiktok',    label: 'TikTok',    color: '#000000' },
            { key: 'facebook',  label: 'Facebook',  color: '#1877F2' },
            { key: 'x_twitter', label: 'X',         color: '#000000' },
            { key: 'youtube',   label: 'YouTube',   color: '#FF0000' },
          ].filter(p => show?.[p.key])
          if (!platforms.length) return null
          return (
            <div className="flex flex-wrap items-center gap-2 mb-8">
              {platforms.map(p => (
                <span key={p.key} className="flex items-center gap-1.5 bg-[#f7f8fa] border border-[#e2e4e8] rounded-full px-3 py-1 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-[#6b6b7a]">{p.label}</span>
                  <span className="text-[#0d0d0f]">{show[p.key]}</span>
                </span>
              ))}
            </div>
          )
        })()}
        <div className="flex flex-col gap-4">
          {sections.map((section) => {
            const status = getStatus(section.name)
            const canImport = section.name in IMPORT_MAP
            const locked = LOCKED_SECTIONS.has(section.name)
            return (
              <div key={section.id} id={section.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')} className="bg-[#f7f8fa] border border-[#e2e4e8] rounded-xl overflow-hidden">
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
                    <button onClick={() => removeSection(section.id, section.name)}
                      className="text-[#c8cad0] hover:text-[#ff5c3a] text-sm ml-2 transition-colors leading-none" title="Remove section">
                      ×
                    </button>
                  )}
                </div>
                <div className="divide-y divide-[#e2e4e8]">
                  {(['host1', 'host2', ...(show.has_producer ? ['producer'] : [])] as string[]).map((role) => {
                    const isHost1 = role === 'host1'
                    const isProducer = role === 'producer'
                    const name = isHost1 ? show.host1_name : isProducer ? show.producer_name : show.host2_name
                    const avatar = isHost1 ? show.host1_avatar : isProducer ? null : show.host2_avatar
                    const color = isHost1 ? 'bg-[#00e5a0]' : isProducer ? 'bg-[#a78bfa]' : 'bg-[#ff5c3a]'
                    const label = isHost1 ? 'Host 1' : isProducer ? 'Producer' : 'Host 2'
                    return (
                      <div key={role} className="flex">
                        <div className="w-28 flex-shrink-0 px-3 py-3 bg-white border-r border-[#e2e4e8] flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
                            {avatar
                              ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
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

                {/* Links row */}
                <div className="border-t border-[#e2e4e8] bg-white px-4 py-2.5 flex items-center gap-2 flex-wrap">
                  <span className="text-[#6b6b7a] text-xs flex items-center gap-1.5 flex-shrink-0 mr-1">
                    🔗 <span className="font-semibold">Links</span>
                  </span>
                  {(links[section.name] || []).map(link => (
                    <span key={link.id} className="flex items-center gap-1 bg-[#f7f8fa] border border-[#e2e4e8] rounded-full px-2.5 py-0.5 text-xs">
                      <a href={link.url} target="_blank" rel="noopener noreferrer"
                        className="text-[#0d0d0f] hover:text-[#00a870] transition-colors max-w-[180px] truncate">
                        {getDomain(link.url)}
                      </a>
                      <button onClick={() => removeLink(link.id, section.name)}
                        className="text-[#c8cad0] hover:text-[#ff5c3a] transition-colors leading-none ml-0.5 flex-shrink-0">×</button>
                    </span>
                  ))}
                  {addingLink[section.name] ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="url"
                        value={linkInput[section.name] || ''}
                        onChange={e => setLinkInput(prev => ({ ...prev, [section.name]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') addLink(section.name)
                          if (e.key === 'Escape') setAddingLink(prev => ({ ...prev, [section.name]: false }))
                        }}
                        placeholder="Paste a URL..."
                        autoFocus
                        className="bg-[#f7f8fa] border border-[#e2e4e8] rounded-lg px-2.5 py-1 text-xs outline-none focus:border-[#00e5a0] w-52 placeholder-[#c8cad0]"
                      />
                      <button onClick={() => addLink(section.name)}
                        className="bg-[#00e5a0] text-black text-xs font-bold rounded-lg px-2.5 py-1 hover:bg-[#00ffc0] transition-colors">
                        Add
                      </button>
                      <button onClick={() => setAddingLink(prev => ({ ...prev, [section.name]: false }))}
                        className="text-[#6b6b7a] text-xs hover:text-[#0d0d0f] transition-colors">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingLink(prev => ({ ...prev, [section.name]: true }))}
                      className="text-[#6b6b7a] text-xs hover:text-[#00a870] transition-colors">
                      + Add link
                    </button>
                  )}
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
              <button onClick={addSection} disabled={addingSection === 'saving'} className="bg-[#00e5a0] text-black font-bold rounded-lg px-4 py-2 text-sm hover:bg-[#00ffc0] transition-colors disabled:opacity-50">{addingSection === 'saving' ? 'Adding...' : 'Add'}</button>
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
