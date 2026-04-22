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

const NOTE_COLORS = ['#cdf0e3', '#f0e2cc']

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
    if (total === 0) return { label: 'EMPTY', badgeBg: 'rgba(0,0,0,0.10)', badgeColor: 'rgba(0,0,0,0.38)' }
    if (total < 20) return { label: 'DRAFT', badgeBg: 'rgba(245,194,66,0.22)', badgeColor: '#7a5200' }
    return { label: 'READY', badgeBg: 'rgba(0,168,112,0.18)', badgeColor: '#005c38' }
  }

  const readySections = sections.filter(s => getStatus(s.name).label === 'READY').length
  const progressPct = sections.length > 0 ? Math.round((readySections / sections.length) * 100) : 0

  const socialHandles = () => {
    const platforms = [
      { key: 'instagram', label: 'Instagram' },
      { key: 'tiktok', label: 'TikTok' },
      { key: 'facebook', label: 'Facebook' },
      { key: 'x_twitter', label: 'X' },
      { key: 'youtube', label: 'YouTube' },
    ]
    return platforms.filter(p => show?.[p.key]).map(p => `${p.label}: ${show[p.key]}`).join('  ·  ')
  }

  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pw = 210; const ph = 297; const ml = 18; const mr = 18; const mt = 18; const cw = pw - ml - mr
    let y = mt

    const pageHeader = (pageNum: number, totalPages: number) => {
      doc.setFillColor(13, 13, 15); doc.rect(0, 0, pw, 14, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0, 229, 160)
      doc.text('SHOWDECK', ml, 9)
      doc.setTextColor(150, 150, 160); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
      doc.text(`Page ${pageNum} of ${totalPages}`, pw - mr, 9, { align: 'right' })
    }

    const checkPage = (needed: number, pageNum: number, totalPages: number): number => {
      if (y + needed > ph - 16) { doc.addPage(); pageHeader(++pageNum, totalPages); y = 22 }
      return pageNum
    }

    const estPages = 1 + Math.ceil(sections.length / 3)
    let pageNum = 1; pageHeader(pageNum, estPages); y = 22

    doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(13, 13, 15)
    doc.text(show?.name || 'Show', ml, y); y += 8
    doc.setFontSize(14); doc.setTextColor(40, 40, 50)
    doc.text(epTitle || 'Untitled Episode', ml, y); y += 7
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100, 100, 115)
    doc.text(formatDate(episodeDate || ''), ml, y); y += 5
    const socials = socialHandles()
    if (socials) { doc.setFontSize(8.5); doc.setTextColor(130, 130, 145); doc.text(socials, ml, y); y += 5 }
    y += 3; doc.setDrawColor(220, 225, 232); doc.setLineWidth(0.4); doc.line(ml, y, pw - mr, y); y += 7

    for (const section of sections) {
      pageNum = checkPage(20, pageNum, estPages)
      doc.setFillColor(247, 248, 250); doc.roundedRect(ml, y, cw, 9, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(13, 13, 15)
      doc.text(`${section.icon}  ${section.name.toUpperCase()}`, ml + 3, y + 6)
      const st = getStatus(section.name)
      const stC = st.label === 'READY' ? [0, 168, 112] : st.label === 'DRAFT' ? [212, 156, 0] : [160, 162, 170]
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(stC[0], stC[1], stC[2])
      doc.text(st.label, pw - mr - 2, y + 6, { align: 'right' }); y += 13

      const roles = ['host1', 'host2', ...(show?.has_producer ? ['producer'] : [])]
      for (const role of roles) {
        const isHost1 = role === 'host1'; const isProd = role === 'producer'
        const name = isHost1 ? show?.host1_name : isProd ? show?.producer_name : show?.host2_name
        const roleLabel = isHost1 ? 'Host 1' : isProd ? 'Producer' : 'Host 2'
        const text = getContent(section.name, role)
        pageNum = checkPage(12, pageNum, estPages)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(60, 62, 70)
        doc.text(`${name}  `, ml, y)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(140, 142, 155)
        doc.text(roleLabel, ml + doc.getTextWidth(`${name}  `), y); y += 5
        if (text) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(30, 32, 40)
          const lines = doc.splitTextToSize(text, cw - 2)
          for (const line of lines) { pageNum = checkPage(6, pageNum, estPages); doc.text(line, ml + 2, y); y += 5 }
        } else {
          doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(180, 182, 192)
          doc.text('No notes', ml + 2, y); y += 5
        }
        y += 3
      }
      if ((links[section.name] || []).length > 0) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(0, 168, 112)
        doc.text(`Linked: ${(links[section.name] || []).map(l => getDomain(l.url)).join(', ')}`, ml, y); y += 6
      }
      y += 3; doc.setDrawColor(235, 237, 240); doc.setLineWidth(0.3); doc.line(ml, y, pw - mr, y); y += 6
    }

    const totalP = doc.getNumberOfPages()
    const ts = new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    for (let p = 1; p <= totalP; p++) {
      doc.setPage(p); doc.setFillColor(247, 248, 250); doc.rect(0, ph - 10, pw, 10, 'F')
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(160, 162, 170)
      doc.text(`Generated by Showdeck · ${ts}`, ml, ph - 4)
      doc.text(`Page ${p} of ${totalP}`, pw - mr, ph - 4, { align: 'right' })
    }
    const slug = (epTitle || 'runsheet').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    doc.save(`${slug}.pdf`)
  }

  if (!show) return (
    <div className="min-h-screen bg-[#1a1714] flex items-center justify-center">
      <div className="text-white/40">Loading...</div>
    </div>
  )

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#1a1714] text-[#0d0d0f] animate-page-in">

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-50 flex items-center gap-2 bg-[#0d0d0f] text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl pointer-events-none ${
          toast.phase === 'in' ? 'animate-toast-in' : 'animate-toast-out'
        }`}>
          <span className="w-4 h-4 rounded-full bg-[#00e5a0] flex items-center justify-center text-black text-[9px] font-black flex-shrink-0">✓</span>
          {toast.msg}
        </div>
      )}

      {/* ── Sticky Nav ── */}
      <header className="sticky top-0 z-20 bg-[#0d0d0f]/95 backdrop-blur border-b border-white/[0.08] px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href={`/shows/${showId}`} className="text-white/50 hover:text-white text-sm transition-colors">← Back</a>
          <span className="text-white/10">|</span>
          <Logo size={0.55} light />
          <span className="border-l border-white/10 pl-3 flex items-center gap-2">
            {show.logo_url && <img src={show.logo_url} alt="logo" className="w-6 h-6 rounded object-cover opacity-80" />}
            <span className="text-white/40 text-xs">{show.name}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs flex items-center gap-1.5 transition-opacity ${saveStatus === 'unsaved' ? 'opacity-100' : 'opacity-0'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
            <span className="text-[#f59e0b]">Unsaved</span>
          </span>
          <button onClick={exportPdf}
            className="text-white/50 border border-white/10 rounded-lg px-4 py-1.5 text-sm hover:text-white hover:border-[#00e5a0]/50 transition-colors">
            Export PDF
          </button>
        </div>
      </header>

      {/* ── Progress bar ── */}
      {sections.length > 0 && (
        <div className="sticky top-14 z-20 bg-[#0d0d0f]/95 backdrop-blur border-b border-white/[0.06] px-6 py-2.5 flex items-center gap-4">
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#00e5a0] rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-xs text-white/30 flex-shrink-0 tabular-nums">
            {readySections}/{sections.length} ready · {progressPct}%
          </span>
        </div>
      )}

      {/* ── Episode title area (on dark bg) ── */}
      <div className="max-w-5xl mx-auto px-8 pt-8 pb-4">
        <input
          type="text" value={epTitle} onChange={e => updateTitle(e.target.value)}
          placeholder={show.show_type === 'radio' ? 'BROADCAST TITLE...' : 'EPISODE TITLE...'}
          className="bg-transparent border-none text-3xl font-bold text-white tracking-widest outline-none w-full mb-1 placeholder-white/20"
        />
        {episodeDate && (
          <p className="text-white/35 text-sm mb-4">{formatDate(episodeDate)}</p>
        )}
        {(() => {
          const platforms = [
            { key: 'instagram', label: 'Instagram', color: '#E1306C' },
            { key: 'tiktok',    label: 'TikTok',    color: '#888' },
            { key: 'facebook',  label: 'Facebook',  color: '#1877F2' },
            { key: 'x_twitter', label: 'X',         color: '#888' },
            { key: 'youtube',   label: 'YouTube',   color: '#FF0000' },
          ].filter(p => show?.[p.key])
          if (!platforms.length) return null
          return (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {platforms.map(p => (
                <span key={p.key} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-xs">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-white/40">{p.label}</span>
                  <span className="text-white/70">{show[p.key]}</span>
                </span>
              ))}
            </div>
          )
        })()}
      </div>

      {/* ── Whiteboard frame ── */}
      <div className="px-4 sm:px-8 pb-10 max-w-5xl mx-auto">
        <div className="rounded-2xl overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
          style={{ border: '10px solid #2e2e2e', outline: '2px solid #3a3a3a' }}>

          {/* Top tray */}
          <div className="bg-[#252525] h-3 flex items-center px-4 gap-1.5">
            {['#555', '#444', '#333'].map((c, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
            ))}
          </div>

          {/* Board surface */}
          <div className="bg-[#fafaf7] px-6 pt-5 pb-8 relative"
            style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 39px, #ece8e0 39px, #ece8e0 40px)' }}>

            {/* Board label row */}
            <div className="flex items-center justify-between mb-8">
              <p className="text-[10px] text-[#b0a898] uppercase tracking-[0.18em] font-semibold">
                {show.name} — Episode Board
              </p>
              <p className="text-[10px] text-[#c8c0b4]">{sections.length} segments</p>
            </div>

            {/* Sticky notes grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
              {sections.map((section, idx) => {
                const status = getStatus(section.name)
                const canImport = section.name in IMPORT_MAP
                const locked = LOCKED_SECTIONS.has(section.name)
                const isCollapsed = collapsed.has(section.name)
                const wc = getWordCount(section.name)
                const noteColor = NOTE_COLORS[idx % 2]
                const noteRotation = idx % 2 === 0 ? 'rotate(-1deg)' : 'rotate(1deg)'
                const roles = ['host1', 'host2', ...(show.has_producer ? ['producer'] : [])] as string[]

                return (
                  <div
                    key={section.id}
                    id={section.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
                    className="sticky-note relative"
                    style={{ backgroundColor: noteColor, borderRadius: '2px', boxShadow: '2px 4px 16px rgba(0,0,0,0.14), 0 1px 3px rgba(0,0,0,0.08)', transform: noteRotation }}
                  >
                    {/* Pushpin */}
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: 'radial-gradient(circle at 35% 35%, #ff8c6a, #cc3a20)', border: '1.5px solid #aa2e18', boxShadow: '0 2px 6px rgba(0,0,0,0.35)' }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                      </div>
                    </div>

                    {/* Note header */}
                    <div className="pt-5 px-4 pb-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-black/25 mb-1.5">
                            Segment {idx + 1}
                          </p>
                          <button
                            type="button"
                            onClick={() => toggleCollapse(section.name)}
                            className="flex items-center gap-1.5 text-left w-full group"
                          >
                            <span className="text-lg leading-none flex-shrink-0">{section.icon}</span>
                            <span className="font-bold text-[14px] text-[#1a1a1a] leading-snug group-hover:text-[#006644] transition-colors">{section.name}</span>
                            <span className={`text-black/25 text-[10px] ml-0.5 transition-transform duration-200 flex-shrink-0 ${isCollapsed ? '' : 'rotate-180'}`}>▾</span>
                          </button>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-0.5">
                          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: status.badgeBg, color: status.badgeColor }}>
                            {status.label}
                          </span>
                          {wc > 0 && <span className="text-[9px] text-black/25 tabular-nums">{wc}w</span>}
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center justify-between mt-1">
                        <div>
                          {canImport && (
                            <button
                              type="button"
                              onClick={() => importFromLastWeek(section.name)}
                              disabled={importing === section.name}
                              className="text-[10px] text-[#00704d] border border-[#00704d]/25 rounded-full px-2.5 py-0.5 bg-white/50 hover:bg-white/80 transition-colors disabled:opacity-50"
                            >
                              {importing === section.name ? 'Importing…' : '↓ Import last week'}
                            </button>
                          )}
                        </div>
                        {locked ? (
                          <span className="text-black/20 text-xs" title="Locked">🔒</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => removeSection(section.id, section.name)}
                            className="text-black/20 hover:text-red-500 text-base leading-none transition-colors"
                            title="Remove section"
                          >×</button>
                        )}
                      </div>
                    </div>

                    {/* Collapsible host note areas */}
                    {!isCollapsed && (
                      <div className="border-t border-black/10">
                        {roles.map((role, roleIdx) => {
                          const isHost1 = role === 'host1'
                          const isProd = role === 'producer'
                          const name = isHost1 ? show.host1_name : isProd ? show.producer_name : show.host2_name
                          const avatar = isHost1 ? show.host1_avatar : isProd ? null : show.host2_avatar
                          const bgColor = isHost1 ? '#00e5a0' : isProd ? '#a78bfa' : '#ff5c3a'
                          const label = isHost1 ? 'Host 1' : isProd ? 'Producer' : 'Host 2'
                          return (
                            <div key={role} className={roleIdx > 0 ? 'border-t border-black/[0.08]' : ''}>
                              <div className="flex items-center gap-2 px-4 pt-2.5 pb-1">
                                <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0"
                                  style={{ background: bgColor }}>
                                  {avatar
                                    ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center text-black text-[9px] font-bold">{name?.[0]}</div>}
                                </div>
                                <span className="text-[10px] font-semibold text-black/50">{name}</span>
                                <span className="text-[10px] text-black/30">· {label}</span>
                              </div>
                              <textarea
                                value={getContent(section.name, role)}
                                onChange={e => updateContent(section.name, role, e.target.value)}
                                placeholder="Your notes..."
                                className="w-full bg-transparent px-4 pb-3 text-sm text-[#1a1a1a] resize-none outline-none leading-relaxed placeholder:text-black/20 placeholder:italic"
                                rows={3}
                              />
                            </div>
                          )
                        })}

                        {/* Links */}
                        <div className="border-t border-black/10 px-4 py-2 flex items-center gap-2 flex-wrap"
                          style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}>
                          <span className="text-[10px] text-black/40 font-semibold flex-shrink-0">🔗</span>
                          {(links[section.name] || []).map(link => (
                            <span key={link.id} className="flex items-center gap-1 bg-white/60 rounded-full px-2 py-0.5 text-[10px]">
                              <a href={link.url} target="_blank" rel="noopener noreferrer"
                                className="text-[#006644] hover:underline max-w-[160px] truncate">
                                {getDomain(link.url)}
                              </a>
                              <button onClick={() => removeLink(link.id, section.name)}
                                className="text-black/20 hover:text-red-500 leading-none ml-0.5">×</button>
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
                                placeholder="Paste URL..." autoFocus
                                className="bg-white/70 border border-black/15 rounded px-2 py-0.5 text-xs outline-none focus:border-[#00704d] w-44 placeholder-black/25" />
                              <button onClick={() => addLink(section.name)}
                                className="bg-[#00a870] text-white text-[10px] font-bold rounded px-2 py-0.5 hover:bg-[#00704d] transition-colors">Add</button>
                              <button onClick={() => setAddingLink(prev => ({ ...prev, [section.name]: false }))}
                                className="text-black/30 text-[10px] hover:text-black/60 transition-colors">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setAddingLink(prev => ({ ...prev, [section.name]: true }))}
                              className="text-[10px] text-black/30 hover:text-[#006644] transition-colors">+ link</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Add section note */}
              {addingSection ? (
                <div className="relative" style={{ backgroundColor: '#f7f5ee', borderRadius: '2px', boxShadow: '2px 4px 16px rgba(0,0,0,0.1)' }}>
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <div className="w-5 h-5 rounded-full" style={{ background: 'radial-gradient(circle at 35% 35%, #aaa, #666)', border: '1.5px solid #555', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }} />
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-black/25">New Segment</p>
                    <div className="flex gap-2">
                      <input type="text" value={newIcon} onChange={e => setNewIcon(e.target.value)}
                        className="w-10 bg-white/60 border border-black/15 rounded text-center text-base outline-none" maxLength={2} />
                      <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addSection(); if (e.key === 'Escape') setAddingSection(false) }}
                        placeholder="Segment name..." autoFocus
                        className="flex-1 bg-white/60 border border-black/15 rounded px-2 py-1.5 text-sm text-[#1a1a1a] outline-none placeholder-black/25" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addSection} disabled={addingSection === 'saving'}
                        className="bg-[#00a870] text-white font-bold rounded px-4 py-1.5 text-sm hover:bg-[#00704d] transition-colors disabled:opacity-50">
                        {addingSection === 'saving' ? 'Adding…' : 'Add'}
                      </button>
                      <button onClick={() => setAddingSection(false)} className="text-black/40 hover:text-black/70 text-sm transition-colors">Cancel</button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingSection(true)}
                  className="relative border-2 border-dashed border-[#c8c0b0] rounded-sm flex flex-col items-center justify-center gap-1 py-10 text-[#b0a898] hover:text-[#7a6e5e] hover:border-[#a09080] transition-colors"
                  style={{ minHeight: '120px' }}
                >
                  <span className="text-2xl leading-none">+</span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest">Add Segment</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom tray */}
          <div className="bg-[#252525] h-5" />
        </div>
      </div>

    </main>
  )
}
