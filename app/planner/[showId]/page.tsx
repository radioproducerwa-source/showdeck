'use client'
import { useEffect, useState, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Logo from '../../../components/Logo'
import GlobalSearch from '../../../components/GlobalSearch'

const DEFAULT_SECTIONS: Record<string, { name: string; icon: string }[]> = {
  podcast: [
    { name: 'Show Intro', icon: '🎙️' },
    { name: 'Main Topic', icon: '💬' },
    { name: 'Guest Interview', icon: '🎤' },
    { name: 'Listener Questions', icon: '❓' },
    { name: 'Outro', icon: '👋' },
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

const getDefaultSections = (showType: string) => {
  if (['radio', 'breakfast_radio', 'drive', 'evening'].includes(showType)) {
    return DEFAULT_SECTIONS.radio
  }
  return DEFAULT_SECTIONS.podcast
}

type SaveStatus = 'saved' | 'saving' | 'unsaved'
type Toast = { msg: string; phase: 'in' | 'out' } | null

const NOTE_COLORS = ['#cdf0e3', '#f0e2cc']

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
  const [duplicating, setDuplicating] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [addingSection, setAddingSection] = useState<boolean | 'saving'>(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📝')
  const [links, setLinks] = useState<Record<string, { id: string; url: string }[]>>({})
  const [addingLink, setAddingLink] = useState<Record<string, boolean>>({})
  const [linkInput, setLinkInput] = useState<Record<string, string>>({})
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
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
        const dateStr = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
        autoTitle = `Episode ${nextNum} — ${dateStr}`
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

      let { data: existingSections } = await supabase.from('sections').select('*').eq('episode_id', episode.id).order('sort_order', { ascending: true }).order('id', { ascending: true })
      if (!existingSections || existingSections.length === 0) {
        const { data: prevEps } = await supabase.from('episodes').select('id').eq('show_id', showId).neq('id', episode.id).order('episode_date', { ascending: false }).limit(1)
        let sectionSource: { name: string; icon: string }[] = getDefaultSections(showData?.show_type || 'podcast')
        if (prevEps && prevEps.length > 0) {
          const { data: prevSections } = await supabase.from('sections').select('name, icon').eq('episode_id', prevEps[0].id)
          if (prevSections && prevSections.length > 0) sectionSource = prevSections
        }
        const { data: inserted } = await supabase.from('sections').insert(sectionSource.map((s, i) => ({ episode_id: episode.id, name: s.name, icon: s.icon, sort_order: i }))).select()
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

  const duplicateFromLastWeek = async () => {
    if (!episodeId || !episodeDate) return
    setDuplicating(true)
    const { data: prevEps } = await supabase.from('episodes').select('*').eq('show_id', showId).lt('episode_date', episodeDate).order('episode_date', { ascending: false }).limit(1)
    if (!prevEps?.length) { showToast('No previous episode found'); setDuplicating(false); return }
    const prevEp = prevEps[0]
    const { data: prevContent } = await supabase.from('section_content').select('*').eq('episode_id', prevEp.id)
    if (!prevContent?.length) { showToast('Previous episode has no content'); setDuplicating(false); return }

    const upserts = prevContent.map((r: any) => ({
      episode_id: episodeId,
      section_name: r.section_name,
      role: r.role,
      content: r.content,
    }))
    await supabase.from('section_content').upsert(upserts, { onConflict: 'episode_id,section_name,role' })

    const newContent: any = {}
    prevContent.forEach((r: any) => { newContent[`${r.section_name}-${r.role}`] = r.content })
    setContent(newContent)
    setDuplicating(false)
    showToast('Duplicated from last week!')
  }

  const archiveEpisode = async () => {
    if (!episodeId) return
    setArchiving(true)
    await supabase.from('episodes').update({ archived: true }).eq('id', episodeId)
    setArchiving(false)
    showToast('Episode archived')
    setTimeout(() => router.push(`/shows/${showId}`), 800)
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
    if (total === 0) return { label: 'EMPTY', cls: 'text-[#6b6b7a] border-[#e2e4e8] bg-black/10', border: 'transparent' }
    if (total < 20) return { label: 'DRAFT', cls: 'text-[#d49c00] border-[#f5c842]/40 bg-[#f5c842]/20', border: '#f5c842' }
    return { label: 'READY', cls: 'text-[#00a870] border-[#00e5a0]/40 bg-[#00e5a0]/20', border: '#00e5a0' }
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

  // ── Drag & Drop ──
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(idx)
  }
  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === idx) { setDragIndex(null); setDragOverIndex(null); return }
    setSections(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(idx, 0, moved)
      // persist new sort_order values
      Promise.all(next.map((s, i) =>
        supabase.from('sections').update({ sort_order: i }).eq('id', s.id)
      )).catch(() => {})
      return next
    })
    setDragIndex(null)
    setDragOverIndex(null)
  }
  const handleDragEnd = () => { setDragIndex(null); setDragOverIndex(null) }

  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pw = 210; const ph = 297
    const ml = 18; const mr = 18
    const cw = pw - ml - mr
    let y = 18

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

    const estPages = 1 + Math.ceil(sections.length / 3)
    let pageNum = 1
    pageHeader(pageNum, estPages)
    y = 22

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

    y += 3
    doc.setDrawColor(220, 225, 232)
    doc.setLineWidth(0.4)
    doc.line(ml, y, pw - mr, y)
    y += 7

    for (const section of sections) {
      pageNum = checkPage(20, pageNum, estPages)

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
    <div className="min-h-screen bg-[#fafaf7] flex items-center justify-center">
      <div className="text-[#6b6b7a]">Loading…</div>
    </div>
  )

  return (
    <main className="min-h-screen text-[#0d0d0f] animate-page-in bg-white">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#0d0d0f] text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl pointer-events-none ${
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
          <span className={`text-xs flex items-center gap-1.5 transition-opacity ${saveStatus === 'unsaved' ? 'opacity-100' : 'opacity-0'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
            <span className="text-[#f59e0b]">Unsaved</span>
          </span>
          <button onClick={duplicateFromLastWeek} disabled={duplicating}
            className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 text-xs hover:text-[#0d0d0f] hover:border-[#c8cad0] transition-colors disabled:opacity-40">
            {duplicating ? 'Duplicating…' : '↓ Duplicate last week'}
          </button>
          <button onClick={archiveEpisode} disabled={archiving || !episodeId}
            className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 text-xs hover:text-[#ff5c3a] hover:border-[#ff5c3a]/40 transition-colors disabled:opacity-40"
            title="Archive this episode — removes it from the current episode slot">
            {archiving ? 'Archiving…' : '📦 Archive'}
          </button>
          <button onClick={exportPdf}
            className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-4 py-1.5 text-sm hover:text-[#0d0d0f] hover:border-[#00e5a0] transition-colors">
            Export PDF
          </button>
          <GlobalSearch />
        </div>
      </header>

      {/* Progress bar */}
      {sections.length > 0 && (
        <div className="sticky top-14 z-10 bg-white/80 backdrop-blur border-b border-[#e2e4e8] px-6 py-2.5 flex items-center gap-4">
          <div className="flex-1 h-1.5 bg-[#e8e4db] rounded-full overflow-hidden">
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
          placeholder={show.show_type === 'radio' ? 'BROADCAST TITLE…' : 'EPISODE TITLE…'}
          className="bg-transparent border-none text-3xl font-bold text-[#0d0d0f] tracking-widest outline-none w-full mb-1 placeholder-[#c8b89a]"
        />
        {episodeDate && (
          <p className="text-[#8a7a64] text-sm mb-6">{formatDate(episodeDate)}</p>
        )}

        {/* Social handles */}
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
                <span key={p.key} className="flex items-center gap-1.5 bg-white/70 border border-[#e2e4e8] rounded-full px-3 py-1 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-[#6b6b7a]">{p.label}</span>
                  <span className="text-[#0d0d0f]">{show[p.key]}</span>
                </span>
              ))}
            </div>
          )
        })()}

        {/* ── Sticky-note section cards ── */}
        <div className="flex flex-col gap-10">
          {sections.map((section, idx) => {
            const status = getStatus(section.name)
            const isCollapsed = collapsed.has(section.name)
            const wc = getWordCount(section.name)
            const noteColor = NOTE_COLORS[idx % NOTE_COLORS.length]
            const isDragging = dragIndex === idx
            const isDragOver = dragOverIndex === idx && dragIndex !== idx

            return (
              <div
                key={section.id}
                id={section.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
                draggable
                onDragStart={e => handleDragStart(e, idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={e => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className="relative transition-all duration-150"
                style={{
                  opacity: isDragging ? 0.4 : 1,
                  transform: isDragOver ? 'scale(1.01)' : 'scale(1)',
                }}
              >
                {/* Push pin */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: 'radial-gradient(circle at 35% 35%, #ff8c6a, #cc3a20)', border: '1.5px solid #aa2e18', boxShadow: '0 2px 6px rgba(0,0,0,0.35)' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.4)' }} />
                  </div>
                </div>

                {/* Sticky note card */}
                <div className="rounded-sm overflow-hidden"
                  style={{ backgroundColor: noteColor, boxShadow: '2px 6px 24px rgba(0,0,0,0.13), 0 1px 3px rgba(0,0,0,0.07)' }}>

                  {/* Card header */}
                  <button
                    type="button"
                    onClick={() => toggleCollapse(section.name)}
                    className="w-full flex items-center gap-3 px-5 py-4 hover:brightness-95 transition-all text-left"
                    style={{ backgroundColor: noteColor }}
                  >
                    {/* Drag handle */}
                    <span className="text-[#0d0d0f]/20 hover:text-[#0d0d0f]/40 cursor-grab active:cursor-grabbing flex-shrink-0 text-xs leading-none select-none">⠿⠿</span>
                    <span className="text-lg leading-none flex-shrink-0">{section.icon}</span>
                    <div>
                      <p className="text-[8px] font-bold uppercase tracking-[0.16em] mb-0.5" style={{ color: 'rgba(0,0,0,0.3)' }}>
                        Segment {idx + 1}
                      </p>
                      <span className="font-bold text-[15px] text-[#1a1a1a]">{section.name}</span>
                    </div>
                    {wc > 0 && (
                      <span className="text-[10px] text-[#0d0d0f]/40 tabular-nums ml-1">{wc}w</span>
                    )}
                    <span className={`ml-auto text-xs font-mono px-2 py-0.5 rounded-full border ${status.cls}`}>{status.label}</span>
                    <button type="button" onClick={e => { e.stopPropagation(); removeSection(section.id, section.name) }}
                      className="text-[#0d0d0f]/20 hover:text-[#ff5c3a] text-xl transition-colors leading-none" title="Remove section">
                      ×
                    </button>
                    <span className={`text-[#0d0d0f]/30 text-xs transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}>▾</span>
                  </button>

                  {/* Collapsible body */}
                  {!isCollapsed && (
                    <div className="bg-white/70 backdrop-blur-sm border-t border-black/10">
                      <div className="divide-y divide-black/10">
                        {(['host1', 'host2', ...(show.has_producer ? ['producer'] : [])] as string[]).map((role) => {
                          const isHost1 = role === 'host1'
                          const isProducer = role === 'producer'
                          const name = isHost1 ? show.host1_name : isProducer ? show.producer_name : show.host2_name
                          const avatar = isHost1 ? show.host1_avatar : isProducer ? null : show.host2_avatar
                          const color = isHost1 ? 'bg-[#00e5a0]' : isProducer ? 'bg-[#a78bfa]' : 'bg-[#ff5c3a]'
                          const label = isHost1 ? 'Host 1' : isProducer ? 'Producer' : 'Host 2'
                          return (
                            <div key={role} className="flex">
                              <div className="w-28 flex-shrink-0 px-3 py-3 bg-white/50 border-r border-black/10 flex items-start gap-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
                                  {avatar
                                    ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
                                    : <div className={`w-full h-full ${color} flex items-center justify-center text-black text-xs font-bold`}>{name?.[0]}</div>
                                  }
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-[#1a1a1a]">{name}</div>
                                  <div className="text-[10px] text-[#6b6b7a]">{label}</div>
                                </div>
                              </div>
                              <textarea value={getContent(section.name, role)} onChange={e => updateContent(section.name, role, e.target.value)}
                                placeholder="Your notes…"
                                className="flex-1 bg-transparent text-sm text-[#1a1a1a] px-4 py-3 outline-none resize-none min-h-[80px] placeholder-[#c8b89a]"
                                rows={3} />
                            </div>
                          )
                        })}
                      </div>

                      {/* Links row */}
                      <div className="border-t border-black/10 bg-white/40 px-4 py-2.5 flex items-center gap-2 flex-wrap">
                        <span className="text-[#6b6b7a] text-xs flex items-center gap-1.5 flex-shrink-0 mr-1">
                          🔗 <span className="font-semibold">Links</span>
                        </span>
                        {(links[section.name] || []).map(link => (
                          <span key={link.id} className="flex items-center gap-1 bg-white/80 border border-black/15 rounded-full px-2.5 py-0.5 text-xs">
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
                              placeholder="Paste a URL…" autoFocus
                              className="bg-white/80 border border-black/20 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-[#00e5a0] w-52 placeholder-[#c8b89a]" />
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
              </div>
            )
          })}

          {/* Add section */}
          {addingSection ? (
            <div className="rounded-sm p-4 flex items-center gap-3"
              style={{ backgroundColor: '#f0f0e8', boxShadow: '2px 4px 16px rgba(0,0,0,0.08)' }}>
              <input type="text" value={newIcon} onChange={e => setNewIcon(e.target.value)}
                className="w-12 bg-white/70 border border-black/15 rounded-lg text-center text-lg outline-none" maxLength={2} />
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addSection(); if (e.key === 'Escape') setAddingSection(false) }}
                placeholder="Segment name…" autoFocus
                className="flex-1 bg-white/70 border border-black/15 rounded-lg px-3 py-2 text-sm text-[#0d0d0f] outline-none placeholder-[#c8b89a]" />
              <button onClick={addSection} disabled={addingSection === 'saving'}
                className="bg-[#00e5a0] text-black font-bold rounded-lg px-4 py-2 text-sm hover:bg-[#00ffc0] transition-colors disabled:opacity-50">
                {addingSection === 'saving' ? 'Adding…' : 'Add'}
              </button>
              <button onClick={() => setAddingSection(false)} className="text-[#6b6b7a] hover:text-[#0d0d0f] text-sm transition-colors">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAddingSection(true)}
              className="border-2 border-dashed border-[#d4c8b0] rounded-sm py-4 text-[#8a7a64] text-sm hover:border-[#00e5a0] hover:text-[#00a870] transition-colors bg-white/30">
              + Add Section
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
