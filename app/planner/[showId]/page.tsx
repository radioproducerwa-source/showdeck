'use client'
import { useEffect, useLayoutEffect, useState, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Logo from '../../../components/Logo'
import GlobalSearch from '../../../components/GlobalSearch'
import ShowChat from '../../../components/ShowChat'
import Toast, { useToast } from '../../../components/Toast'
import {
  IconGrip, IconLink, IconArchive, IconDownload, IconChevronDown,
  IconPlus, IconX, IconCopy, PageLoader,
} from '../../../components/icons'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  other: [
    { name: 'Intro', icon: '▶️' },
    { name: 'Main Segment', icon: '💬' },
    { name: 'Feature', icon: '⭐' },
    { name: 'Outro', icon: '👋' },
  ],
}

const getDefaultSections = (showType: string) => {
  if (['radio', 'breakfast_radio', 'drive', 'evening'].includes(showType)) {
    return DEFAULT_SECTIONS.radio
  }
  if (showType === 'other') return DEFAULT_SECTIONS.other
  return DEFAULT_SECTIONS.podcast
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

const ACCENT_COLORS = ['#00e5a0', '#f5c842']

// Pick black or white text for legibility on a given background colour
function contrastText(hex: string) {
  const h = (hex || '').replace('#', '')
  if (h.length < 6) return '#ffffff'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.55 ? '#0d0d0f' : '#ffffff'
}

// ── Sortable wrapper ──
function SortableItem({ id, children }: { id: string; children: (listeners: any) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
    >
      {children(listeners)}
    </div>
  )
}

export default function Planner({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = use(params)
  const [show, setShow] = useState<any>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [sections, setSections] = useState<any[]>([])
  const [content, setContent] = useState<any>({})
  const [epTitle, setEpTitle] = useState('')
  const [episodeId, setEpisodeId] = useState<string | null>(null)
  const [episodeDate, setEpisodeDate] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const { toast, showToast } = useToast()
  const [importingBets, setImportingBets] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [addingSection, setAddingSection] = useState<boolean | 'saving'>(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📝')
  const [links, setLinks] = useState<Record<string, { id: string; url: string }[]>>({})
  const [addingLink, setAddingLink] = useState<Record<string, boolean>>({})
  const [linkInput, setLinkInput] = useState<Record<string, string>>({})
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set())
  // Which host note panels are shown per section, keyed `${sectionName}-${role}`.
  // A panel is active once it has been added (or already has saved notes).
  const [activeRoles, setActiveRoles] = useState<Set<string>>(new Set())
  const [savingTemplate, setSavingTemplate] = useState(false)
  const saveTimers = useRef<Record<string, { id: any; run: () => void }>>({})
  const titleTimer = useRef<{ id: any; run: () => void } | null>(null)
  const dirtyKeys = useRef<Set<string>>(new Set())
  const inFlight = useRef(0)
  const errorRef = useRef(false)
  const saveStatusRef = useRef<SaveStatus>('saved')
  const router = useRouter()

  const setStatus = (s: SaveStatus) => { saveStatusRef.current = s; setSaveStatus(s) }

  const recomputeStatus = () => {
    setStatus(
      errorRef.current ? 'error'
        : dirtyKeys.current.size > 0 ? 'unsaved'
        : inFlight.current > 0 ? 'saving'
        : 'saved'
    )
  }

  const flushPendingSaves = () => {
    Object.values(saveTimers.current).forEach(entry => {
      if (entry) { clearTimeout(entry.id); entry.run() }
    })
    saveTimers.current = {}
    if (titleTimer.current) {
      const entry = titleTimer.current
      titleTimer.current = null
      clearTimeout(entry.id)
      entry.run()
    }
  }

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Flush pending debounced saves on unload/unmount so typed content isn't lost
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatusRef.current !== 'saved') {
        flushPendingSaves()
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      flushPendingSaves()
    }
  }, [])

  useEffect(() => {
    if (sections.length > 0 && window.location.hash) {
      const el = document.getElementById(window.location.hash.slice(1))
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [sections])

  // Resize all visible textareas when content first loads or a role panel is expanded.
  // The active textarea already self-resizes via onInput, so `content` is deliberately
  // not a dependency (avoids re-measuring every textarea on every keystroke).
  useLayoutEffect(() => {
    document.querySelectorAll<HTMLTextAreaElement>('textarea').forEach(el => {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    })
  }, [expandedRoles, sections.length])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: showData } = await supabase.from('shows').select('*').eq('id', showId).single()
    if (!showData) { router.push('/dashboard'); return }
    if (showData.owner_id !== user.id) {
      const { data: membership } = await supabase.from('show_members').select('id').eq('show_id', showId).eq('user_id', user.id).maybeSingle()
      if (!membership) { router.push('/dashboard'); return }
    } else {
      setIsOwner(true)
    }
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
      const { data: episodes } = await supabase.from('episodes').select('*').eq('show_id', showId).eq('episode_date', today)
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
        // Priority: section_templates → previous episode → default
        const { data: templates } = await supabase.from('section_templates')
          .select('name, icon')
          .eq('show_id', showId)
          .order('order_index', { ascending: true })

        let sectionSource: { name: string; icon: string }[] = getDefaultSections(showData?.show_type || 'podcast')

        if (templates && templates.length > 0) {
          sectionSource = templates
        } else {
          const { data: prevEps } = await supabase.from('episodes').select('id').eq('show_id', showId).neq('id', episode.id).order('episode_date', { ascending: false }).limit(1)
          if (prevEps && prevEps.length > 0) {
            const { data: prevSections } = await supabase.from('sections').select('name, icon').eq('episode_id', prevEps[0].id)
            if (prevSections && prevSections.length > 0) sectionSource = prevSections
          }
        }

        const { data: inserted } = await supabase.from('sections').insert(sectionSource.map((s, i) => ({ episode_id: episode.id, name: s.name, icon: s.icon, sort_order: i }))).select()
        existingSections = inserted || []
      }
      setSections(existingSections)

      // Punt Pals: ensure protected sections always exist on every episode
      if (showId === '8265f874-9732-4b6b-8617-a6c5918c6ca7') {
        const missing = (["Last Week's Betting"] as string[]).filter(
          name => !(existingSections || []).some((s: any) => s.name === name)
        )
        if (missing.length > 0) {
          const maxOrder = Math.max(...(existingSections || []).map((s: any) => s.sort_order ?? 0), -1)
          const { data: added } = await supabase.from('sections').insert(
            missing.map((name, i) => ({ episode_id: episode.id, name, icon: '📊', sort_order: maxOrder + 1 + i }))
          ).select()
          if (added) existingSections = [...(existingSections || []), ...added]
          setSections(existingSections)
        }
      }

      const [{ data: saved }, { data: savedLinks }] = await Promise.all([
        supabase.from('section_content').select('*').eq('episode_id', episode.id),
        supabase.from('section_links').select('*').eq('episode_id', episode.id)
      ])

      if (saved && saved.length > 0) {
        const map: any = {}
        saved.forEach((row: any) => { map[`${row.section_name}-${row.role}`] = row.content })
        setContent(map)

        // A host panel is shown if a note row already exists for it (even empty —
        // an empty row is written when someone adds the panel).
        const hostRoles = ['host1', 'host2', ...(showData?.has_producer ? ['producer'] : [])]
        const active = new Set<string>()
        saved.forEach((row: any) => {
          if (hostRoles.includes(row.role)) active.add(`${row.section_name}-${row.role}`)
        })
        setActiveRoles(active)

        // Expand active panels that are still empty so they're ready to type in
        const toExpand = new Set<string>()
        existingSections?.forEach((section: any) => {
          hostRoles.forEach(role => {
            if (!active.has(`${section.name}-${role}`)) return
            const c = map[`${section.name}-${role}`]
            if (!c || !c.trim()) toExpand.add(`${section.id}-${role}`)
          })
        })
        setExpandedRoles(toExpand)
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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async data load; setState only runs after awaits resolve
  useEffect(() => { init() }, [])

  const toggleCollapse = (name: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  const toggleRole = (sectionId: string, role: string) => {
    const key = `${sectionId}-${role}`
    setExpandedRoles(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key); else n.add(key)
      return n
    })
  }

  const expandRole = (sectionId: string, role: string) => {
    setExpandedRoles(prev => { const n = new Set(prev); n.add(`${sectionId}-${role}`); return n })
  }

  // Add a host's note panel to a section. Writes an empty note row so the panel
  // is still there after a reload.
  const addRolePanel = async (sectionName: string, sectionId: string, role: string) => {
    setActiveRoles(prev => new Set(prev).add(`${sectionName}-${role}`))
    setContent((prev: any) => ({ ...prev, [`${sectionName}-${role}`]: prev[`${sectionName}-${role}`] ?? '' }))
    expandRole(sectionId, role)
    if (!episodeId) return
    const { error } = await supabase.from('section_content').upsert(
      { episode_id: episodeId, section_name: sectionName, role, content: '' },
      { onConflict: 'episode_id,section_name,role', ignoreDuplicates: true }
    )
    if (error) showToast('Could not add that panel — try again', true)
  }

  // Remove a host's note panel (and its notes) from a section.
  const removeRolePanel = async (sectionName: string, sectionId: string, role: string) => {
    const key = `${sectionName}-${role}`
    const previous = content[key]
    setActiveRoles(prev => { const n = new Set(prev); n.delete(key); return n })
    setContent((prev: any) => { const n = { ...prev }; delete n[key]; return n })
    setExpandedRoles(prev => { const n = new Set(prev); n.delete(`${sectionId}-${role}`); return n })
    clearTimeout(saveTimers.current[key]?.id)
    delete saveTimers.current[key]
    dirtyKeys.current.delete(key)
    if (!episodeId) return
    const { error } = await supabase.from('section_content').delete()
      .eq('episode_id', episodeId).eq('section_name', sectionName).eq('role', role)
    if (error) {
      // Put it back if the delete failed
      setActiveRoles(prev => new Set(prev).add(key))
      setContent((prev: any) => ({ ...prev, [key]: previous ?? '' }))
      showToast('Could not remove that panel — try again', true)
    }
  }

  const collapseRoleOnBlur = (e: React.FocusEvent, sectionId: string, role: string) => {
    const key = `${sectionId}-${role}`
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      const content_val = content[`${(sections.find(s => s.id === sectionId)?.name || '')}-${role}`] || ''
      if (content_val.trim()) {
        setExpandedRoles(prev => { const n = new Set(prev); n.delete(key); return n })
      }
    }
  }

  const removeSection = async (sectionId: string, sectionName: string) => {
    if (episodeId) await supabase.from('section_links').delete().eq('episode_id', episodeId).eq('section_name', sectionName)
    const { error } = await supabase.from('sections').delete().eq('id', sectionId)
    if (error) { showToast('Remove failed — check your connection', true); return }
    setSections(prev => prev.filter(s => s.id !== sectionId))
    setLinks(prev => { const n = { ...prev }; delete n[sectionName]; return n })
  }

  const addLink = async (sectionName: string) => {
    const raw = (linkInput[sectionName] || '').trim()
    if (!raw || !episodeId) return
    const url = raw.startsWith('http') ? raw : `https://${raw}`
    const { data, error } = await supabase.from('section_links').insert({ episode_id: episodeId, section_name: sectionName, url }).select().single()
    if (error) { showToast('Could not save link — try again', true); return }
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
    const { data } = await supabase.from('sections').insert({ episode_id: episodeId, name: newName.trim(), icon: newIcon, sort_order: sections.length }).select().single()
    if (data) {
      setSections(prev => [...prev, data])
      // auto-expand new section's roles
      const roles = ['host1', 'host2', ...(show?.has_producer ? ['producer'] : [])]
      setExpandedRoles(prev => {
        const n = new Set(prev)
        roles.forEach(r => n.add(`${data.id}-${r}`))
        return n
      })
    }
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
    const { error: upsertErr } = await supabase.from('section_content').upsert(upserts, { onConflict: 'episode_id,section_name,role' })
    if (upsertErr) { showToast('Duplicate failed — check your connection', true); setDuplicating(false); return }

    const newContent: any = {}
    prevContent.forEach((r: any) => { newContent[`${r.section_name}-${r.role}`] = r.content })
    setContent((prev: any) => ({ ...prev, ...newContent }))
    // Reveal the host panels the duplicated notes belong to
    setActiveRoles(prev => {
      const n = new Set(prev)
      prevContent.forEach((r: any) => { if (r.role !== 'communal') n.add(`${r.section_name}-${r.role}`) })
      return n
    })
    setDuplicating(false)
    showToast('Duplicated from last week!')
  }

  const importLastWeeksBets = async () => {
    if (!episodeId || !episodeDate) return
    setImportingBets(true)
    const { data: prevEps } = await supabase
      .from('episodes').select('id')
      .eq('show_id', showId).lt('episode_date', episodeDate)
      .order('episode_date', { ascending: false }).limit(1)
    if (!prevEps?.length) { showToast('No previous bets found'); setImportingBets(false); return }

    const { data: prevContent } = await supabase
      .from('section_content').select('section_name, role, content')
      .eq('episode_id', prevEps[0].id)
      .in('section_name', ['AFL Multis', 'Racing Bets'])
      .in('role', ['host1', 'host2'])
    if (!prevContent?.length) { showToast('No previous bets found'); setImportingBets(false); return }

    for (const role of ['host1', 'host2']) {
      const parts = ['AFL Multis', 'Racing Bets']
        .map(name => {
          const row = prevContent.find((r: any) => r.role === role && r.section_name === name)
          return row?.content ? `${name}:\n${row.content}` : null
        })
        .filter(Boolean)
      if (!parts.length) continue
      updateContent("Last Week's Betting", role, parts.join('\n\n'))
    }
    flushPendingSaves()
    setImportingBets(false)
    showToast("Last week's bets imported!")
  }


  const archiveEpisode = async () => {
    if (!episodeId) return
    flushPendingSaves()
    setArchiving(true)
    const { error } = await supabase.from('episodes').update({ archived: true }).eq('id', episodeId)
    setArchiving(false)
    if (error) {
      showToast('Archive failed — make sure the DB migration has been run', true)
      return
    }
    showToast('Episode archived')
    setTimeout(() => router.push(`/shows/${showId}`), 800)
  }

  const TITLE_KEY = '__title__'

  const updateTitle = (value: string) => {
    setEpTitle(value)
    dirtyKeys.current.add(TITLE_KEY)
    setStatus('unsaved')
    if (titleTimer.current) clearTimeout(titleTimer.current.id)
    const run = () => { titleTimer.current = null; saveTitle(value) }
    titleTimer.current = { id: setTimeout(run, 800), run }
  }

  const saveTitle = async (value: string) => {
    if (!episodeId) return
    dirtyKeys.current.delete(TITLE_KEY)
    inFlight.current++
    setStatus('saving')
    const { error } = await supabase.from('episodes').update({ title: value }).eq('id', episodeId)
    inFlight.current--
    const wasError = errorRef.current
    errorRef.current = !!error
    recomputeStatus()
    if (error) showToast('Save failed — check your connection', true)
    else if (wasError) showToast('Saved')
  }

  const updateContent = (sectionName: string, role: string, value: string) => {
    setContent((prev: any) => ({ ...prev, [`${sectionName}-${role}`]: value }))
    const key = `${sectionName}-${role}`
    // Writing notes for a host (e.g. Duplicate last week, imports) reveals their panel
    if (role !== 'communal') setActiveRoles(prev => prev.has(key) ? prev : new Set(prev).add(key))
    dirtyKeys.current.add(key)
    setStatus('unsaved')
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key].id)
    const run = () => { delete saveTimers.current[key]; saveContent(sectionName, role, value) }
    saveTimers.current[key] = { id: setTimeout(run, 800), run }
  }

  const saveContent = async (sectionName: string, role: string, value: string) => {
    if (!episodeId) return
    const key = `${sectionName}-${role}`
    dirtyKeys.current.delete(key)
    inFlight.current++
    setStatus('saving')
    const { error } = await supabase.from('section_content').upsert(
      { episode_id: episodeId, section_name: sectionName, role, content: value },
      { onConflict: 'episode_id,section_name,role' }
    )
    inFlight.current--
    const wasError = errorRef.current
    errorRef.current = !!error
    recomputeStatus()
    if (error) showToast('Save failed — check your connection', true)
    else if (wasError) showToast('Saved')
  }

  const getContent = (sectionName: string, role: string) => content[`${sectionName}-${role}`] || ''

  const getWordCount = (sectionName: string) => {
    const all = ['communal', 'host1', 'host2', 'producer'].map(r => getContent(sectionName, r)).join(' ')
    return all.trim().split(/\s+/).filter(Boolean).length
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const getStatus = (sectionName: string) => {
    const total = getContent(sectionName, 'communal').length + getContent(sectionName, 'host1').length + getContent(sectionName, 'host2').length + getContent(sectionName, 'producer').length
    if (total === 0) return { label: 'EMPTY', color: '#9a9aaa' }
    if (total < 20) return { label: 'DRAFT', color: '#d49c00' }
    return { label: 'READY', color: '#00a870' }
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

  // ── dnd-kit drag end ──
  const handleDndEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = sections.findIndex(s => s.id === active.id)
    const newIdx = sections.findIndex(s => s.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(sections, oldIdx, newIdx)
    setSections(next)
    const results = await Promise.all(next.map((s, i) => supabase.from('sections').update({ sort_order: i }).eq('id', s.id)))
    if (results.some(r => r.error)) showToast('Reorder failed to save — check connection', true)
  }

  // ── Save as Template ──
  const saveAsTemplate = async () => {
    if (!showId || sections.length === 0) return
    setSavingTemplate(true)
    await supabase.from('section_templates').delete().eq('show_id', showId)
    const rows = sections.map((s, i) => ({ show_id: showId, name: s.name, icon: s.icon || '📝', order_index: i }))
    const { error } = await supabase.from('section_templates').insert(rows)
    setSavingTemplate(false)
    showToast(error ? 'Failed to save template' : 'Template saved!', !!error)
  }

  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pw = 210; const ph = 297
    const ml = 18; const mr = 18
    const cw = pw - ml - mr
    let y = 18

    const stripEmoji = (str: string) =>
      str.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/gu, '').trim()

    const pageHeader = (pageNum: number, totalPages: number) => {
      doc.setFillColor(13, 13, 15)
      doc.rect(0, 0, pw, 14, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(0, 229, 160)
      doc.text('SHOWDECK', ml, 9)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 160)
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

    doc.setFont('helvetica', 'bold')
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
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(130, 130, 145)
      doc.text(socials, ml, y)
      y += 5
    }

    y += 4
    doc.setDrawColor(220, 225, 232)
    doc.setLineWidth(0.4)
    doc.line(ml, y, pw - mr, y)
    y += 9

    for (const section of sections) {
      pageNum = checkPage(24, pageNum, estPages)

      const sectionLabel = stripEmoji(section.name).toUpperCase() || section.name.toUpperCase()
      const st = getStatus(section.name)
      const stRgb: [number, number, number] = st.label === 'READY' ? [0, 168, 112] : st.label === 'DRAFT' ? [212, 156, 0] : [150, 152, 162]

      doc.setFillColor(242, 243, 246)
      doc.roundedRect(ml, y, cw, 11, 2, 2, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(13, 13, 15)
      doc.text(sectionLabel, ml + 4, y + 7.2)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...stRgb)
      doc.text(st.label, pw - mr - 4, y + 7.2, { align: 'right' })

      y += 15

      const communalText = getContent(section.name, 'communal')
      if (communalText.trim()) {
        pageNum = checkPage(12, pageNum, estPages)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(150, 152, 162)
        doc.text('TOPICS & TALKING POINTS', ml, y)
        y += 4.5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        doc.setTextColor(30, 32, 40)
        const communalLines = doc.splitTextToSize(communalText, cw - 4)
        for (const line of communalLines) {
          pageNum = checkPage(6, pageNum, estPages)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9.5)
          doc.setTextColor(30, 32, 40)
          doc.text(line, ml + 2, y)
          y += 5
        }
        y += 4
        doc.setDrawColor(228, 230, 236)
        doc.setLineWidth(0.2)
        doc.line(ml, y, pw - mr, y)
        y += 6
      }

      const roles = ['host1', 'host2', ...(show?.has_producer ? ['producer'] : [])]
      for (const role of roles) {
        const text = getContent(section.name, role)
        if (!text.trim()) continue

        const isHost1 = role === 'host1'
        const isProd  = role === 'producer'
        const name      = (isHost1 ? show?.host1_name : isProd ? show?.producer_name : show?.host2_name) || ''
        const roleLabel = isHost1 ? 'Host 1' : isProd ? 'Producer' : 'Host 2'

        pageNum = checkPage(16, pageNum, estPages)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(40, 42, 52)
        doc.text(name, ml, y)
        y += 4.5

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(155, 157, 170)
        doc.text(roleLabel, ml, y)
        y += 5.5

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        doc.setTextColor(30, 32, 40)
        const lines = doc.splitTextToSize(text, cw - 4)
        for (const line of lines) {
          pageNum = checkPage(6, pageNum, estPages)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9.5)
          doc.setTextColor(30, 32, 40)
          doc.text(line, ml + 2, y)
          y += 5
        }
        y += 5
      }

      const sectionLinks = links[section.name] || []
      if (sectionLinks.length > 0) {
        pageNum = checkPage(8, pageNum, estPages)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(0, 168, 112)
        doc.text(`Links: ${sectionLinks.map(l => getDomain(l.url)).join('  ·  ')}`, ml, y)
        y += 7
      }

      y += 2
      doc.setDrawColor(228, 230, 236)
      doc.setLineWidth(0.3)
      doc.line(ml, y, pw - mr, y)
      y += 9
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

  if (!show) return <PageLoader />

  return (
    <main className="min-h-screen text-[#0d0d0f] animate-page-in bg-[#f7f8fa]">
      <Toast toast={toast} />

      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-[#e2e4e8] px-3 sm:px-6 py-2 sm:h-14">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-3 flex-shrink-0">
            <a href={`/shows/${showId}`} className="text-[#6b6b7a] hover:text-[#0d0d0f] text-sm transition-colors">← Back</a>
            <span className="text-[#e2e4e8]">|</span>
            <Logo size={0.55} />
            <span className="border-l border-[#e2e4e8] pl-3 flex items-center gap-2">
              {show.logo_url && <img src={show.logo_url} alt="logo" className="w-6 h-6 rounded object-cover" />}
              <span className="text-[#6b6b7a] text-xs">{show.name}</span>
            </span>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            {saveStatus === 'error' && (
              <span className="text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-red-500 font-medium">Save failed — check connection</span>
              </span>
            )}
            {saveStatus === 'unsaved' && (
              <span className="text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                <span className="text-[#f59e0b]">Unsaved</span>
              </span>
            )}
            <button onClick={saveAsTemplate} disabled={savingTemplate || sections.length === 0}
              className="hidden sm:inline-flex items-center gap-1.5 text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 text-xs hover:text-[#0d0d0f] hover:border-[#c8cad0] hover:bg-[#f7f8fa] transition-colors disabled:opacity-40"
              title="Save current sections as the default template for new episodes">
              <IconCopy size={13} />{savingTemplate ? 'Saving…' : 'Save as template'}
            </button>
            <button onClick={duplicateFromLastWeek} disabled={duplicating}
              className="hidden sm:inline-flex items-center gap-1.5 text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 text-xs hover:text-[#0d0d0f] hover:border-[#c8cad0] hover:bg-[#f7f8fa] transition-colors disabled:opacity-40">
              <IconDownload size={13} />{duplicating ? 'Duplicating…' : 'Duplicate last week'}
            </button>
            <button onClick={archiveEpisode} disabled={archiving || !episodeId}
              className="inline-flex items-center text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-2.5 py-1.5 text-xs hover:text-[#ff5c3a] hover:border-[#ff5c3a]/40 transition-colors disabled:opacity-40"
              title="Archive this episode">
              <IconArchive size={14} /><span className="hidden sm:inline ml-1.5">{archiving ? 'Archiving…' : 'Archive'}</span>
            </button>
            <button onClick={exportPdf}
              className="inline-flex items-center gap-1.5 text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 text-xs sm:text-sm hover:text-[#0d0d0f] hover:border-[#c8cad0] hover:bg-[#f7f8fa] transition-colors">
              <IconDownload size={13} /><span><span className="hidden sm:inline">Export </span>PDF</span>
            </button>
            {isOwner && <a href={`/show-settings/${showId}`} className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 text-xs sm:text-sm hover:text-[#0d0d0f] transition-colors whitespace-nowrap">Settings</a>}
            <GlobalSearch />
          </div>
        </div>
      </header>

      {/* Progress bar */}
      {sections.length > 0 && (
        <div className="sticky top-14 z-10 bg-white/80 backdrop-blur border-b border-[#e2e4e8] px-6 py-2.5 flex items-center gap-4">
          <div className="flex-1 h-1.5 bg-[#e2e4e8] rounded-full overflow-hidden">
            <div className="h-full bg-[#00e5a0] rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-xs text-[#6b6b7a] flex-shrink-0 tabular-nums">
            {readySections}/{sections.length} ready · {progressPct}%
          </span>
        </div>
      )}

      {/* Episode title banner */}
      {(() => {
        const c = show.header_color || '#00e5a0'
        const onC = contrastText(c)
        const subtle = onC === '#0d0d0f' ? 'rgba(13,13,15,0.6)' : 'rgba(255,255,255,0.8)'
        return (
          <div style={{ backgroundColor: c }} className="border-b border-black/10">
            <div className="max-w-5xl mx-auto px-3 sm:px-6 py-5">
              <input
                type="text" value={epTitle} onChange={e => updateTitle(e.target.value)}
                placeholder={show.show_type === 'radio' ? 'BROADCAST TITLE…' : 'EPISODE TITLE…'}
                className={`bg-transparent border-none text-2xl sm:text-3xl font-bold tracking-tight outline-none w-full ${onC === '#ffffff' ? 'placeholder-white/50' : 'placeholder-black/40'}`}
                style={{ color: onC }}
              />
              {episodeDate && (
                <p className="text-sm mt-1" style={{ color: subtle }}>{formatDate(episodeDate)}</p>
              )}
            </div>
          </div>
        )
      })()}

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6">
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

        {/* ── Section cards ── */}
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDndEnd}>
          <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-10">
              {sections.map((section, idx) => {
                const status = getStatus(section.name)
                const isCollapsed = collapsed.has(section.name)
                const wc = getWordCount(section.name)
                const accentColor = ACCENT_COLORS[idx % ACCENT_COLORS.length]

                return (
                  <SortableItem key={section.id} id={section.id}>
                    {(dragListeners) => (
                      <div
                        className="relative transition-all duration-150"
                        id={section.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
                      >
                        {/* Section card */}
                        <div className="bg-white border border-[#e2e4e8] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(13,13,15,0.04)]">
                          {/* Accent strip */}
                          <div className="h-[3px] w-full" style={{ backgroundColor: accentColor }} />

                          {/* Card header */}
                          <div className="w-full flex items-center gap-3 px-3 sm:px-5 py-3 sm:py-4 bg-[#fafbfc]">
                            {/* Drag handle */}
                            <span
                              {...dragListeners}
                              className="text-[#c8cad0] hover:text-[#6b6b7a] cursor-grab active:cursor-grabbing flex-shrink-0 leading-none select-none touch-none transition-colors"
                              title="Drag to reorder"
                            ><IconGrip size={14} /></span>
                            <button
                              type="button"
                              onClick={() => toggleCollapse(section.name)}
                              className="flex items-center gap-3 flex-1 min-w-0 text-left"
                            >
                              <span className="text-lg leading-none flex-shrink-0">{section.icon}</span>
                              <div>
                                <p className="text-[8px] font-bold uppercase tracking-[0.16em] mb-0.5 text-[#9a9aaa]">
                                  Segment {idx + 1}
                                </p>
                                <span className="font-bold text-[15px] text-[#1a1a1a]">{section.name}</span>
                              </div>
                              {wc > 0 && (
                                <span className="text-[10px] text-[#9a9aaa] tabular-nums ml-1">{wc}w</span>
                              )}
                              <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: status.color }}>
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
                                {status.label}
                              </span>
                            </button>
                            {showId === '8265f874-9732-4b6b-8617-a6c5918c6ca7' && section.name === "Last Week's Betting" && (
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); importLastWeeksBets() }}
                                disabled={importingBets}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6b6b7a] hover:text-[#0d0d0f] bg-white border border-[#e2e4e8] hover:border-[#c8cad0] hover:bg-[#f7f8fa] rounded-md px-2 py-1 transition-colors flex-shrink-0 disabled:opacity-40"
                              >
                                <IconDownload size={12} />{importingBets ? '…' : 'Import last week'}
                              </button>
                            )}
                            {!(showId === '8265f874-9732-4b6b-8617-a6c5918c6ca7' && (["Last Week's Betting", 'AFL Multis', 'Racing Bets'] as string[]).includes(section.name)) && (
                              <button type="button" onClick={e => { e.stopPropagation(); removeSection(section.id, section.name) }}
                                className="text-[#c8cad0] hover:text-[#ff5c3a] transition-colors leading-none flex-shrink-0" title="Remove section">
                                <IconX size={15} />
                              </button>
                            )}
                            <button type="button" onClick={() => toggleCollapse(section.name)}
                              className="text-[#9a9aaa] flex-shrink-0 transition-transform duration-200"
                              style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
                              <IconChevronDown size={14} />
                            </button>
                          </div>

                          {/* Collapsible body */}
                          {!isCollapsed && (
                            <div className="bg-white border-t border-[#e2e4e8]">

                              {/* Communal / shared topics area */}
                              <div className="px-3 sm:px-5 pt-3 pb-2.5 border-b border-[#e2e4e8]">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-[#9a9aaa] mb-1.5">Topics &amp; Talking Points</p>
                                <textarea
                                  value={getContent(section.name, 'communal')}
                                  onChange={e => updateContent(section.name, 'communal', e.target.value)}
                                  onInput={e => {
                                    const el = e.currentTarget
                                    el.style.height = 'auto'
                                    el.style.height = el.scrollHeight + 'px'
                                  }}
                                  placeholder="Add the topics and key points for this segment — visible to everyone…"
                                  className="w-full bg-white text-sm text-[#1a1a1a] outline-none resize-none placeholder-[#b8bac2] block leading-relaxed"
                                  style={{ minHeight: '52px', overflowY: 'hidden' }}
                                />
                              </div>

                              <div className="divide-y divide-[#e2e4e8]">
                                {(['host1', 'host2', ...(show.has_producer ? ['producer'] : [])] as string[])
                                  .filter(role => activeRoles.has(`${section.name}-${role}`))
                                  .map((role) => {
                                  const isHost1 = role === 'host1'
                                  const isProducer = role === 'producer'
                                  const name = isHost1 ? show.host1_name : isProducer ? show.producer_name : show.host2_name
                                  const avatar = isHost1 ? show.host1_avatar : isProducer ? null : show.host2_avatar
                                  const color = isHost1 ? 'bg-[#00e5a0]' : isProducer ? 'bg-[#a78bfa]' : 'bg-[#ff5c3a]'
                                  const label = isHost1 ? 'Host 1' : isProducer ? 'Producer' : 'Host 2'
                                  const roleKey = `${section.id}-${role}`
                                  const isExpanded = expandedRoles.has(roleKey)
                                  const noteText = getContent(section.name, role)
                                  const previewLine = noteText.split('\n')[0].slice(0, 80)

                                  return (
                                    <div
                                      key={role}
                                      onBlur={(e) => collapseRoleOnBlur(e, section.id, role)}
                                    >
                                      {/* Host panel header — always visible */}
                                      <div className="w-full flex items-center group/role">
                                      <button
                                        type="button"
                                        onClick={() => toggleRole(section.id, role)}
                                        className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#f7f8fa] transition-colors text-left"
                                      >
                                        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                                          {avatar
                                            ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
                                            : <div className={`w-full h-full ${color} flex items-center justify-center text-black text-xs font-bold`}>{name?.[0]}</div>
                                          }
                                        </div>
                                        <div className="flex-shrink-0">
                                          <div className="text-xs font-semibold text-[#1a1a1a] leading-tight">{name}</div>
                                          <div className="text-[10px] text-[#6b6b7a]">{label}</div>
                                        </div>
                                        {!isExpanded && previewLine && (
                                          <p className="flex-1 text-xs text-[#6b6b7a] truncate ml-2 min-w-0">
                                            {previewLine}
                                          </p>
                                        )}
                                        {!isExpanded && !previewLine && (
                                          <p className="flex-1 text-xs text-[#b8bac2] italic ml-2">No notes yet…</p>
                                        )}
                                        <span
                                          className="text-[#9a9aaa] flex-shrink-0 transition-transform duration-200 ml-auto"
                                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                        ><IconChevronDown size={14} /></span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeRolePanel(section.name, section.id, role)}
                                        title={`Remove ${name}'s notes from this segment`}
                                        className="px-3 py-2.5 text-[#c8cad0] hover:text-[#ff5c3a] transition-colors flex-shrink-0 opacity-100 sm:opacity-0 group-hover/role:opacity-100 focus:opacity-100"
                                      ><IconX size={14} /></button>
                                      </div>

                                      {/* Expandable textarea — smooth height animation */}
                                      <div
                                        className="grid transition-all duration-200 ease-in-out"
                                        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                                      >
                                        <div className={isExpanded ? '' : 'overflow-hidden'}>
                                          <textarea
                                            value={noteText}
                                            onChange={e => updateContent(section.name, role, e.target.value)}
                                            onFocus={() => expandRole(section.id, role)}
                                            onInput={e => {
                                              const el = e.currentTarget;
                                              el.style.height = 'auto';
                                              el.style.height = el.scrollHeight + 'px';
                                            }}
                                            placeholder="Your notes…"
                                            className="w-full bg-white text-sm text-[#1a1a1a] px-4 py-3 outline-none resize-none placeholder-[#b8bac2] block border-t border-[#eef0f3]"
                                            style={{ minHeight: '120px', overflowY: 'hidden' }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>

                              {/* Add a host's notes to this segment */}
                              {(() => {
                                const inactive = (['host1', 'host2', ...(show.has_producer ? ['producer'] : [])] as string[])
                                  .filter(role => !activeRoles.has(`${section.name}-${role}`))
                                if (inactive.length === 0) return null
                                return (
                                  <div className="border-t border-[#e2e4e8] px-3 py-2.5 flex items-center gap-2 flex-wrap">
                                    {inactive.map(role => {
                                      const isHost1 = role === 'host1'
                                      const isProducer = role === 'producer'
                                      const name = isHost1 ? show.host1_name : isProducer ? show.producer_name : show.host2_name
                                      const color = isHost1 ? 'bg-[#00e5a0]' : isProducer ? 'bg-[#a78bfa]' : 'bg-[#ff5c3a]'
                                      if (!name) return null
                                      return (
                                        <button
                                          key={role}
                                          type="button"
                                          onClick={() => addRolePanel(section.name, section.id, role)}
                                          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6b6b7a] hover:text-[#0d0d0f] bg-white border border-[#e2e4e8] hover:border-[#c8cad0] hover:bg-[#f7f8fa] rounded-full pl-1.5 pr-3 py-1 transition-colors"
                                        >
                                          <span className={`w-5 h-5 rounded-full ${color} flex items-center justify-center text-black text-[10px] font-bold flex-shrink-0`}>{name?.[0]}</span>
                                          <IconPlus size={11} /> {name}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )
                              })()}

                              {/* Links row */}
                              <div className="border-t border-[#e2e4e8] bg-[#fafbfc] px-4 py-2.5 flex items-center gap-2 flex-wrap">
                                <span className="text-[#6b6b7a] text-xs flex items-center gap-1.5 flex-shrink-0 mr-1">
                                  <IconLink size={13} /> <span className="font-semibold">Links</span>
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
                                      placeholder="Paste a URL…" autoFocus
                                      className="bg-white border border-[#e2e4e8] rounded-lg px-2.5 py-1 text-xs outline-none focus:border-[#00e5a0] w-52 placeholder-[#b8bac2]" />
                                    <button onClick={() => addLink(section.name)}
                                      className="bg-[#00e5a0] text-black text-xs font-semibold rounded-lg px-2.5 py-1 hover:bg-[#00d494] active:scale-[0.99] transition-all">Add</button>
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
                    )}
                  </SortableItem>
                )
              })}

              {/* Add section */}
              {addingSection ? (
                <div className="bg-[#f7f8fa] border border-[#e2e4e8] rounded-2xl p-4 flex items-center gap-3 shadow-[0_1px_2px_rgba(13,13,15,0.04)]">
                  <input type="text" value={newIcon} onChange={e => setNewIcon(e.target.value)}
                    className="w-12 bg-white border border-[#e2e4e8] rounded-lg text-center text-lg outline-none" maxLength={2} />
                  <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addSection(); if (e.key === 'Escape') setAddingSection(false) }}
                    placeholder="Segment name…" autoFocus
                    className="flex-1 bg-white border border-[#e2e4e8] rounded-lg px-3 py-2 text-sm text-[#0d0d0f] outline-none placeholder-[#b8bac2]" />
                  <button onClick={addSection} disabled={addingSection === 'saving'}
                    className="bg-[#00e5a0] text-black font-semibold rounded-xl px-4 py-2 text-sm hover:bg-[#00d494] active:scale-[0.99] transition-all disabled:opacity-50">
                    {addingSection === 'saving' ? 'Adding…' : 'Add'}
                  </button>
                  <button onClick={() => setAddingSection(false)} className="text-[#6b6b7a] hover:text-[#0d0d0f] text-sm transition-colors">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setAddingSection(true)}
                  className="inline-flex items-center justify-center gap-1.5 border-2 border-dashed border-[#e2e4e8] rounded-2xl py-4 text-[#9a9aaa] text-sm hover:border-[#00e5a0] hover:text-[#00a870] transition-colors bg-white">
                  <IconPlus size={14} /> Add section
                </button>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>
      <ShowChat showId={showId} />
    </main>
  )
}
