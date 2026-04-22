'use client'
import { useEffect, useState, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Logo from '../../../components/Logo'

const DEFAULT_SECTIONS: Record<string, { name: string; icon: string }[]> = {
  podcast: [
    { name: 'Show Intro', icon: '🎙️' },
    { name: 'Weekend Recap', icon: '📅' },
    { name: "Last Week's Betting", icon: '📊' },
    { name: 'Hero of the Week', icon: '⭐' },
    { name: 'Next Round of AFL Games', icon: '🏉' },
    { name: 'AFL Multis', icon: '💰' },
    { name: 'Racing', icon: '🏇' },
    { name: 'Racing Bets', icon: '🐎' },
    { name: '$100 to $1000 Challenge', icon: '🎯' },
  ],
  radio: [
    { name: 'News', icon: '📰' },
    { name: 'Sport', icon: '🏆' },
    { name: 'Weather', icon: '⛅' },
    { name: 'Traffic', icon: '🚗' },
    { name: 'Music Sweep', icon: '🎵' },
    { name: 'Talkback', icon: '📞' },
    { name: 'Competition', icon: '🎁' },
    { name: 'Interview', icon: '🎤' },
    { name: 'Wrap', icon: '👋' },
  ],
}

const LOCKED_SECTIONS = new Set(["Last Week's Betting", 'AFL Multis'])

const IMPORT_MAP: Record<string, string[]> = {
  "Last Week's Betting": ['AFL Multis', 'Racing Bets'],
  'Racing Bets': ['Racing', 'Racing Bets'],
}

type SaveStatus = 'saved' | 'saving' | 'unsaved'
type Toast = { msg: string; phase: 'in' | 'out' } | null

export default function Planner({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = use(params)
  const [show, setShow] = useState<any>(null)
  const [sections, setSections] = useState<any[]>([])
  const [content, setContent] = useState<any>({})
  const [epTitle, setEpTitle] = useState('')
  const [episodeId, setEpisodeId] = useState<string | null>(null)
  const [episodeDate, setEpisodeDate] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [toast, setToast] = useState<Toast>(null)
  const [importing, setImporting] = useState<string | null>(null)
  const [addingSection, setAddingSection] = useState<boolean | 'saving'>(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📝')
  const [links, setLinks] = useState<Record<string, { id: string; url: string }[]>>({})
  const [addingLink, setAddingLink] = useState<Record<string, boolean>>({})
  const [linkInput, setLinkInput] = useState<Record<string, string>>({})
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const saveTimers = useRef<any>({})
  const titleTimer = useRef<any>(null)
  const toastTimer = useRef<any>(null)
  const router = useRouter()

  useEffect(() => { init() }, [])

  useEffect(() => {
    if (sections.length > 0 && window.location.hash) {
      const el = document.getElementById(window.location.hash.slice(1))
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [sections])

  const showToast = (msg: string) => {
    clearTimeout(toastTimer.current)
    setToast({ msg, phase: 'in' })
    toastTimer.current = setTimeout(() => {
      setToast(t => t ? { ...t, phase: 'out' } : null)
      toastTimer.current = setTimeout(() => setToast(null), 220)
    }, 1800)
  }

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
      const { data: prevEps } = await supabase.from('episodes').select('title')
        .eq('show_id', showId).order('episode_date', { ascending: false }).order('id', { ascending: false }).limit(1)
      let autoTitle = ''
      const prevTitle = prevEps?.[0]?.title || ''
      const match = prevTitle.match(/episode\s*(\d+)/i)
      if (match) {
        const nextNum = parseInt(match[1]) + 1
        const now = new Date()
        const day = now.getDay()
        const monday = new Date(now)
        monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day))
        const weekDate = monday.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })
        autoTitle = `${showData.name} - Episode ${nextNum} - Week Commencing ${weekDate}`
      }
      const { data: newEp } = await supabase.from('episodes').insert({ show_id: showId, title: autoTitle, episode_date: today }).select().single()
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
        const { data: prevEps } = await supabase.from('episodes').select('id').eq('show_id', showId).neq('id', episode.id).order('episode_date', { ascending: false }).limit(1)
        let sectionSource: { name: string; icon: string }[] = DEFAULT_SECTIONS[showData?.show_type || 'podcast']
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

  const toggleCollapse = (name: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
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
    if (!prevContent || prevContent.length === 0) { alert('No content found in the previous episode.'); setImporting(null); return }

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
    setImporting(null)
    showToast('Imported from last week')
  }

  const updateTitle = (value: string) => {
    setEpTitle(value); setSaveStatus('unsaved')
    clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(async () => {
      if (!episodeId) return
      setSaveStatus('saving')
      const { error } = await supabase.from('episodes').update({ title: value }).eq('id', episodeId)
      setSaveStatus(error ? 'unsaved' : 'saved')
      if (!error) showToast('Saved')
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
    if (!error) showToast('Saved')
  }

  const getContent = (sectionName: string, role: string) => content[`${sectionName}-${role}`] || ''

  const getWordCount = (sectionName: string) => {
    const all = ['host1', 'host2', 'producer'].map(r => getContent(sectionName, r)).join(' ')
    return all.trim().split(/\s+/).filter(Boolean).length
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const getStatus = (sectionName: string) => {
    const total = getContent(sectionName, 'host1').length + getContent(sectionName, 'host2').length + getContent(sectionName, 'producer').length
    if (total === 0) return { label: 'EMPTY', cls: 'text-[#6b6b7a] border-[#e2e4e8] bg-[#f0f0f4]', border: '#e2e4e8' }
    if (total < 20) return { label: 'DRAFT', cls: 'text-[#d49c00] border-[#f5c842]/40 bg-[#f5c842]/10', border: '#f5c842' }
    return { label: 'READY', cls: 'text-[#00a870] border-[#00e5a0]/40 bg-[#00e5a0]/10', border: '#00e5a0' }
  }

  const readySections = sections.filter(s => getStatus(s.name).label === 'READY').length
  const progressPct = sections.length > 0 ? Math.round((readySections / sections.length) * 100) : 0

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

  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pw = 210; const ph = 297
    const ml = 18; const mr = 18; const mt = 18
    const cw = pw - ml - mr
    let y = mt

    const pageHeader = (pageNum: number, totalPages: number) => {
      doc.setFillColor(13, 13, 15)
      doc.rect(0, 0, pw, 14, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(0, 229, 160)
      doc.text('SHOWDECK', ml, 9)
      doc.setTextColor(150, 150, 160)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`Page ${pageNum} of ${totalPages}`, pw - mr, 9, { align: 'right' })
    }

    const checkPage = (needed: number, pageNum: number, totalPages: number): number => {
      if (y + needed > ph - 16) {
        doc.addPage()
        pageHeader(++pageNum, totalPages)
        y = 22
      }
      return pageNum
    }

    // Calculate total pages (rough estimate — 1 + 1 per section)
    const estPages = 1 + Math.ceil(sections.length / 3)
    let pageNum = 1
    pageHeader(pageNum, estPages)
    y = 22

    // Show + episode header
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(13, 13, 15)
    doc.text(show?.name || 'Show', ml, y)
    y += 8

    doc.setFontSize(14)
    doc.setTextColor(40, 40, 50)
    doc.text(epTitle || 'Untitled Episode', ml, y)
    y += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 115)
    doc.text(formatDate(episodeDate || ''), ml, y)
    y += 5

    const socials = socialHandles()
    if (socials) {
      doc.setFontSize(8.5)
      doc.setTextColor(130, 130, 145)
      doc.text(socials, ml, y)
      y += 5
    }

    // Divider
    y += 3
    doc.setDrawColor(220, 225, 232)
    doc.setLineWidth(0.4)
    doc.line(ml, y, pw - mr, y)
    y += 7

    // Sections
    for (const section of sections) {
      pageNum = checkPage(20, pageNum, estPages)

      // Section heading bar
      doc.setFillColor(247, 248, 250)
      doc.roundedRect(ml, y, cw, 9, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(13, 13, 15)
      doc.text(`${section.icon}  ${section.name.toUpperCase()}`, ml + 3, y + 6)
      const st = getStatus(section.name)
      const stColor = st.label === 'READY' ? [0, 168, 112] : st.label === 'DRAFT' ? [212, 156, 0] : [160, 162, 170]
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(stColor[0], stColor[1], stColor[2])
      doc.text(st.label, pw - mr - 2, y + 6, { align: 'right' })
      y += 13

      // Per-role content
      const roles = ['host1', 'host2', ...(show?.has_producer ? ['producer'] : [])]
      for (const role of roles) {
        const isHost1 = role === 'host1'
        const isProd = role === 'producer'
        const name = isHost1 ? show?.host1_name : isProd ? show?.producer_name : show?.host2_name
        const roleLabel = isHost1 ? 'Host 1' : isProd ? 'Producer' : 'Host 2'
        const text = getContent(section.name, role)

        pageNum = checkPage(12, pageNum, estPages)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(60, 62, 70)
        doc.text(`${name}  `, ml, y)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(140, 142, 155)
        doc.text(roleLabel, ml + doc.getTextWidth(`${name}  `), y)
        y += 5

        if (text) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9.5)
          doc.setTextColor(30, 32, 40)
          const lines = doc.splitTextToSize(text, cw - 2)
          for (const line of lines) {
            pageNum = checkPage(6, pageNum, estPages)
            doc.text(line, ml + 2, y)
            y += 5
          }
        } else {
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(9)
          doc.setTextColor(180, 182, 192)
          doc.text('No notes', ml + 2, y)
          y += 5
        }
        y += 3
      }

      if ((links[section.name] || []).length > 0) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(0, 168, 112)
        doc.text(`🔗 ${(links[section.name] || []).map(l => getDomain(l.url)).join(', ')}`, ml, y)
        y += 6
      }

      y += 3
      doc.setDrawColor(235, 237, 240)
      doc.setLineWidth(0.3)
      doc.line(ml, y, pw - mr, y)
      y += 6
    }

    // Footer on each page
    const totalP = doc.getNumberOfPages()
    const ts = new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    for (let p = 1; p <= totalP; p++) {
      doc.setPage(p)
      doc.setFillColor(247, 248, 250)
      doc.rect(0, ph - 10, pw, 10, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(160, 162, 170)
      doc.text(`Generated by Showdeck · ${ts}`, ml, ph - 4)
      doc.text(`Page ${p} of ${totalP}`, pw - mr, ph - 4, { align: 'right' })
    }

    const slug = (epTitle || 'runsheet').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    doc.save(`${slug}.pdf`)
  }

  if (!show) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-[#6b6b7a]">Loading...</div>
    </div>
  )

  return (
    <main className="min-h-screen bg-white text-[#0d0d0f] animate-page-in">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-50 flex items-center gap-2 bg-[#0d0d0f] text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl pointer-events-none ${
          toast.phase === 'in' ? 'animate-toast-in' : 'animate-toast-out'
        }`}>
          <span className="w-4 h-4 rounded-full bg-[#00e5a0] flex items-center justify-center text-black text-[9px] font-black flex-shrink-0">✓</span>
          {toast.msg}
        </div>
      )}

      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-[#e2e4e8] px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href={`/shows/${showId}`} className="text-[#6b6b7a] hover:text-[#0d0d0f] text-sm transition-colors">← Back</a>
          <span className="text-[#e2e4e8]">|</span>
          <Logo size={0.55} />
          <span className="border-l border-[#e2e4e8] pl-3 flex items-center gap-2">
            {show.logo_url && <img src={show.logo_url} alt="logo" className="w-6 h-6 rounded object-cover" />}
            <span className="text-[#6b6b7a] text-xs">{show.name}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Save indicator (subtle, inline) */}
          <span className={`text-xs flex items-center gap-1.5 transition-opacity ${saveStatus === 'unsaved' ? 'opacity-100' : 'opacity-0'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
            <span className="text-[#f59e0b]">Unsaved</span>
          </span>
          <button onClick={exportPdf}
            className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-4 py-1.5 text-sm hover:text-[#0d0d0f] hover:border-[#00e5a0] transition-colors">
            Export PDF
          </button>
        </div>
      </header>

      {/* Progress bar */}
      {sections.length > 0 && (
        <div className="sticky top-14 z-10 bg-white border-b border-[#e2e4e8] px-6 py-2.5 flex items-center gap-4">
          <div className="flex-1 h-1.5 bg-[#f0f0f4] rounded-full overflow-hidden">
            <div className="h-full bg-[#00e5a0] rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-xs text-[#6b6b7a] flex-shrink-0 tabular-nums">
            {readySections}/{sections.length} ready · {progressPct}%
          </span>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-6">
        <input
          type="text" value={epTitle} onChange={e => updateTitle(e.target.value)}
          placeholder={show.show_type === 'radio' ? 'BROADCAST TITLE...' : 'EPISODE TITLE...'}
          className="bg-transparent border-none text-3xl font-bold text-[#0d0d0f] tracking-widest outline-none w-full mb-1 placeholder-[#d1d5db]"
        />
        {episodeDate && (
          <p className="text-[#6b6b7a] text-sm mb-6">{formatDate(episodeDate)}</p>
        )}
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

        <div className="flex flex-col gap-3">
          {sections.map((section) => {
            const status = getStatus(section.name)
            const canImport = section.name in IMPORT_MAP
            const locked = LOCKED_SECTIONS.has(section.name)
            const isCollapsed = collapsed.has(section.name)
            const wc = getWordCount(section.name)

            return (
              <div key={section.id} id={section.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
                className="bg-[#f7f8fa] border border-[#e2e4e8] rounded-xl overflow-hidden"
                style={{ borderLeftWidth: '3px', borderLeftColor: status.border }}>

                {/* Section header — clickable to collapse */}
                <button
                  type="button"
                  onClick={() => toggleCollapse(section.name)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-white border-b border-[#e2e4e8] hover:bg-[#fafafa] transition-colors text-left"
                >
                  <span className="text-lg leading-none flex-shrink-0">{section.icon}</span>
                  <span className="font-semibold text-[15px] flex-1 text-[#0d0d0f]">{section.name}</span>
                  {wc > 0 && (
                    <span className="text-[10px] text-[#c8cad0] tabular-nums">{wc}w</span>
                  )}
                  {canImport && (
                    <button type="button" onClick={e => { e.stopPropagation(); importFromLastWeek(section.name) }}
                      disabled={importing === section.name}
                      className="text-xs text-[#00a870] border border-[#00e5a0]/40 rounded-full px-3 py-0.5 hover:bg-[#00e5a0]/10 transition-colors disabled:opacity-50">
                      {importing === section.name ? 'Importing...' : '↓ Import last week'}
                    </button>
                  )}
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${status.cls}`}>{status.label}</span>
                  {locked ? (
                    <span className="text-[#c8cad0] text-xs" title="Locked">🔒</span>
                  ) : (
                    <button type="button" onClick={e => { e.stopPropagation(); removeSection(section.id, section.name) }}
                      className="text-[#c8cad0] hover:text-[#ff5c3a] text-sm transition-colors leading-none" title="Remove section">
                      ×
                    </button>
                  )}
                  <span className={`text-[#c8cad0] text-xs transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}>▾</span>
                </button>

                {/* Collapsible body */}
                {!isCollapsed && (
                  <div>
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
                              className="flex-1 bg-transparent text-sm text-[#0d0d0f] px-4 py-3 outline-none resize-none min-h-[80px] placeholder-[#c8cad0]"
                              rows={3} />
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
                          <input type="url" value={linkInput[section.name] || ''}
                            onChange={e => setLinkInput(prev => ({ ...prev, [section.name]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') addLink(section.name)
                              if (e.key === 'Escape') setAddingLink(prev => ({ ...prev, [section.name]: false }))
                            }}
                            placeholder="Paste a URL..." autoFocus
                            className="bg-[#f7f8fa] border border-[#e2e4e8] rounded-lg px-2.5 py-1 text-xs outline-none focus:border-[#00e5a0] w-52 placeholder-[#c8cad0]" />
                          <button onClick={() => addLink(section.name)}
                            className="bg-[#00e5a0] text-black text-xs font-bold rounded-lg px-2.5 py-1 hover:bg-[#00ffc0] transition-colors">Add</button>
                          <button onClick={() => setAddingLink(prev => ({ ...prev, [section.name]: false }))}
                            className="text-[#6b6b7a] text-xs hover:text-[#0d0d0f] transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setAddingLink(prev => ({ ...prev, [section.name]: true }))}
                          className="text-[#6b6b7a] text-xs hover:text-[#00a870] transition-colors">+ Add link</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {addingSection ? (
            <div className="bg-[#f7f8fa] border border-[#e2e4e8] rounded-xl p-4 flex items-center gap-3">
              <input type="text" value={newIcon} onChange={e => setNewIcon(e.target.value)}
                className="w-12 bg-white border border-[#e2e4e8] rounded-lg text-center text-lg outline-none" maxLength={2} />
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addSection(); if (e.key === 'Escape') setAddingSection(false) }}
                placeholder="Segment name..." autoFocus
                className="flex-1 bg-white border border-[#e2e4e8] rounded-lg px-3 py-2 text-sm text-[#0d0d0f] outline-none placeholder-[#c8cad0]" />
              <button onClick={addSection} disabled={addingSection === 'saving'}
                className="bg-[#00e5a0] text-black font-bold rounded-lg px-4 py-2 text-sm hover:bg-[#00ffc0] transition-colors disabled:opacity-50">
                {addingSection === 'saving' ? 'Adding...' : 'Add'}
              </button>
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
