'use client'
import { useEffect, useState, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Logo from '../../../components/Logo'
import GlobalSearch from '../../../components/GlobalSearch'
import Toast, { useToast } from '../../../components/Toast'
import {
  IconMic, IconClipboard, IconLightbulb, IconArchive, IconRadio, IconUsers,
  IconArrowLeft, IconArrowRight, IconGrip, IconX, IconCheck, IconPlus,
  IconRefresh, IconLink, IconSearch, IconPencil, Spinner, PageLoader,
} from '../../../components/icons'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, useSortable, rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const PIN_COLORS = ['#ff6b52', '#4a90e2']
const PIN_SHADOWS = ['#cc3a20', '#2c5aa0']

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

function SortableNote({ id, children }: { id: string; children: (dragListeners: any) => React.ReactNode }) {
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

function SortableIdeaItem({ id, children }: { id: string; children: (dragListeners: any) => React.ReactNode }) {
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

export default function ShowDetail({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = use(params)
  const [show, setShow] = useState<any>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [currentEp, setCurrentEp] = useState<any>(null)
  const [sections, setSections] = useState<any[]>([])
  const [contentMap, setContentMap] = useState<Record<string, string>>({})
  const [episodes, setEpisodes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [radioWeeks, setRadioWeeks] = useState<string[]>([])
  const [weekSlots, setWeekSlots] = useState<Record<string, Record<string, { title: string; notes: string }>>>({})
  const [selectedDow, setSelectedDow] = useState<number>(() => {
    const d = new Date().getDay()
    return d >= 1 && d <= 5 ? d : 1
  })
  const [archiveSearch, setArchiveSearch] = useState('')
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const { toast, showToast } = useToast()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'runsheet' | 'ideas'>('runsheet')
  const [columns, setColumns] = useState<{ id: string; title: string; order_index: number; mode: string; last_cleared_week: string | null }[]>([])
  const [ideas, setIdeas] = useState<{ id: string; column_id: string | null; text: string; done: boolean; order_index: number; url?: string; notes?: string }[]>([])
  const [newIdeaTextByCol, setNewIdeaTextByCol] = useState<Record<string, string>>({})
  const [ideaLinkOpen, setIdeaLinkOpen] = useState<Record<string, boolean>>({})
  const [ideaLinkInput, setIdeaLinkInput] = useState<Record<string, string>>({})
  const [ideaNotesOpen, setIdeaNotesOpen] = useState<Record<string, boolean>>({})
  const [ideaDeleteConfirm, setIdeaDeleteConfirm] = useState<string | null>(null)
  const [colDeleteConfirm, setColDeleteConfirm] = useState<string | null>(null)

  const whiteboardSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleWhiteboardDndEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = sections.findIndex((s: any) => s.id === active.id)
    const newIdx = sections.findIndex((s: any) => s.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(sections, oldIdx, newIdx)
    setSections(next)
    const results = await Promise.all(next.map((s: any, i: number) => supabase.from('sections').update({ sort_order: i }).eq('id', s.id)))
    if (results.some(r => r.error)) showToast('Reorder failed to save — check connection', true)
  }

  const handleIdeaDndEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = ideas.findIndex(i => i.id === active.id)
    const newIdx = ideas.findIndex(i => i.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(ideas, oldIdx, newIdx)
    const colId = ideas[oldIdx].column_id
    setIdeas(next)
    const colItems = next.filter(i => i.column_id === colId && !i.done)
    const results = await Promise.all(colItems.map((i, idx) => supabase.from('show_ideas').update({ order_index: idx }).eq('id', i.id)))
    if (results.some(r => r.error)) showToast('Reorder failed to save — check connection', true)
  }

  const handleColumnDndEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = columns.findIndex(c => c.id === active.id)
    const newIdx = columns.findIndex(c => c.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(columns, oldIdx, newIdx)
    setColumns(next)
    const results = await Promise.all(next.map((c, i) => supabase.from('show_idea_columns').update({ order_index: i }).eq('id', c.id)))
    if (results.some(r => r.error)) showToast('Reorder failed to save — check connection', true)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      Promise.all([
        supabase.from('shows').select('*').eq('id', showId).single(),
        supabase.from('episodes').select('*').eq('show_id', showId).order('episode_date', { ascending: false }).order('id', { ascending: false })
      ]).then(async ([{ data: showData }, { data: eps }]) => {
        if (!showData) { router.push('/dashboard'); return }
        if (showData.owner_id !== data.user!.id) {
          const { data: membership } = await supabase.from('show_members').select('id').eq('show_id', showId).eq('user_id', data.user!.id).maybeSingle()
          if (!membership) { router.push('/dashboard'); return }
        } else {
          setIsOwner(true)
        }
        setShow(showData)
        Promise.all([
          supabase.from('show_idea_columns').select('*').eq('show_id', showId).order('order_index'),
          supabase.from('show_ideas').select('*').eq('show_id', showId).order('order_index'),
        ]).then(async ([{ data: cols }, { data: ideaRows }]) => {
          let colList = cols || []
          let ideas = ideaRows || []
          if (colList.length === 0) {
            const { data } = await supabase.from('show_idea_columns').insert([
              { show_id: showId, title: 'Phoners / Topicals / Raves', order_index: 0 },
              { show_id: showId, title: 'Show Tactics / Segments', order_index: 1 },
            ]).select()
            colList = data || []
          }
          // Auto-clear completed items from weekly columns when a new week starts
          const monday = (() => {
            const d = new Date()
            const day = d.getDay()
            const diff = d.getDate() - day + (day === 0 ? -6 : 1)
            const m = new Date(d); m.setDate(diff)
            // Local-timezone date string — toISOString() is UTC and produced
            // Sunday's date early on Monday mornings in UTC+ timezones,
            // causing double-clears that deleted ideas.
            return m.toLocaleDateString('en-CA')
          })()
          const weeklyDue = colList.filter((c: any) => c.mode === 'weekly' && c.last_cleared_week !== monday)
          let totalCleared = 0
          for (const col of weeklyDue) {
            const completed = ideas.filter((i: any) => i.column_id === col.id && i.done)
            if (completed.length > 0) {
              await supabase.from('show_ideas').delete().eq('column_id', col.id).eq('done', true)
              ideas = ideas.filter((i: any) => !(i.column_id === col.id && i.done))
              totalCleared += completed.length
            }
            await supabase.from('show_idea_columns').update({ last_cleared_week: monday }).eq('id', col.id)
            colList = colList.map((c: any) => c.id === col.id ? { ...c, last_cleared_week: monday } : c)
          }
          setIdeas(ideas)
          setColumns(colList)
          if (totalCleared > 0) {
            showToast(`Weekly columns refreshed — ${totalCleared} completed ${totalCleared === 1 ? 'item' : 'items'} cleared`, false)
          }
        })
        if (['radio', 'breakfast_radio', 'drive', 'evening'].includes(showData?.show_type)) {
          const now = new Date()
          const nowDay = now.getDay()
          const weekMon = new Date(now)
          weekMon.setDate(now.getDate() + (nowDay === 0 ? -6 : 1 - nowDay))
          const weekFri = new Date(weekMon)
          weekFri.setDate(weekMon.getDate() + 4)
          const mondayStr = weekMon.toLocaleDateString('en-CA')
          const fridayStr = weekFri.toLocaleDateString('en-CA')
          Promise.all([
            supabase.from('radio_plans').select('plan_date').eq('show_id', showId),
            supabase.from('radio_plans').select('plan_date,hour,slot_key,title,notes').eq('show_id', showId).gte('plan_date', mondayStr).lte('plan_date', fridayStr),
          ]).then(([{ data: planRows }, { data: weekRows }]) => {
            if (planRows) {
              const seen = new Set<string>()
              planRows.forEach((r: any) => {
                const d = new Date(r.plan_date + 'T00:00:00')
                const day = d.getDay()
                const mon = new Date(d)
                mon.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
                seen.add(mon.toLocaleDateString('en-CA'))
              })
              setRadioWeeks(Array.from(seen).sort().reverse())
            }
            if (weekRows) {
              const map: Record<string, Record<string, { title: string; notes: string }>> = {}
              weekRows.forEach((r: any) => {
                if (!map[r.plan_date]) map[r.plan_date] = {}
                map[r.plan_date][`${r.hour}-${r.slot_key}`] = { title: r.title || '', notes: r.notes || '' }
              })
              setWeekSlots(map)
            }
          })
        }
        const allEps = eps || []
        setEpisodes(allEps)
        const latest = allEps.find((e: any) => !e.archived)
        if (latest) {
          setCurrentEp(latest)
          Promise.all([
            supabase.from('sections').select('*').eq('episode_id', latest.id).order('sort_order', { ascending: true }).order('id', { ascending: true }),
            supabase.from('section_content').select('*').eq('episode_id', latest.id)
          ]).then(([{ data: secs }, { data: contentRows }]) => {
            setSections(secs || [])
            const map: Record<string, string> = {}
            contentRows?.forEach((r: any) => { map[`${r.section_name}-${r.role}`] = r.content })
            setContentMap(map)
            setLoading(false)
          })
        } else {
          setLoading(false)
        }
      })
    })
  }, [])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const currentWeekRange = () => {
    const today = new Date()
    const day = today.getDay()
    const mon = new Date(today)
    mon.setDate(today.getDate() + (day === 0 ? -6 : 1 - day))
    const fri = new Date(mon)
    fri.setDate(mon.getDate() + 4)
    return `${mon.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${fri.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }

  const uploadAvatar = async (slot: 'host1' | 'host2' | 'producer', file: File) => {
    const key = `${showId}-${slot}`
    setUploading(key)
    const ext = file.name.split('.').pop()
    const path = `${showId}-${slot}.${ext}`
    const { error: uploadError } = await supabase.storage.from('show-logos').upload(path, file, { upsert: true })
    if (uploadError) { alert('Upload failed: ' + uploadError.message); setUploading(null); return }
    const { data: { publicUrl } } = supabase.storage.from('show-logos').getPublicUrl(path)
    const field = slot === 'host1' ? 'host1_avatar' : slot === 'host2' ? 'host2_avatar' : 'producer_avatar'
    await supabase.from('shows').update({ [field]: publicUrl }).eq('id', showId)
    setShow((prev: any) => ({ ...prev, [field]: publicUrl }))
    setUploading(null)
  }

  const getInitials = (name: string) =>
    (name || '').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '??'

  const getSectionPreview = (sectionName: string) => {
    const text = (contentMap[`${sectionName}-host1`] || '') || (contentMap[`${sectionName}-host2`] || '')
    return text.split('\n')[0].slice(0, 100) || null
  }

  const getSectionStatus = (sectionName: string) => {
    const total = (contentMap[`${sectionName}-host1`] || '').length + (contentMap[`${sectionName}-host2`] || '').length
    if (total === 0) return 'empty'
    if (total < 20) return 'draft'
    return 'ready'
  }

  const addIdea = async (columnId: string) => {
    const text = (newIdeaTextByCol[columnId] || '').trim()
    if (!text) return
    const order_index = ideas.filter(i => i.column_id === columnId && !i.done).length
    const { data, error } = await supabase.from('show_ideas').insert({ show_id: showId, column_id: columnId, text, done: false, order_index }).select().single()
    if (error) { showToast('Failed to add idea — check your connection', true); return }
    // Only clear the input once the insert has succeeded, so failed adds keep the text
    setNewIdeaTextByCol(prev => ({ ...prev, [columnId]: '' }))
    setIdeas(prev => [...prev, data])
  }

  const toggleIdea = async (id: string, done: boolean) => {
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, done } : i))
    const { error } = await supabase.from('show_ideas').update({ done }).eq('id', id)
    if (error) {
      setIdeas(prev => prev.map(i => i.id === id ? { ...i, done: !done } : i))
      showToast("Couldn't save — try again", true)
    }
  }

  const deleteIdea = async (id: string) => {
    const removed = ideas.find(i => i.id === id)
    setIdeas(prev => prev.filter(i => i.id !== id))
    const { error } = await supabase.from('show_ideas').delete().eq('id', id)
    if (error) {
      if (removed) setIdeas(prev => [...prev, removed])
      showToast("Couldn't save — try again", true)
    }
  }

  const saveIdeaUrl = async (id: string, raw: string) => {
    const url = raw.trim() ? (raw.trim().startsWith('http') ? raw.trim() : `https://${raw.trim()}`) : ''
    const prevUrl = ideas.find(i => i.id === id)?.url
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, url } : i))
    setIdeaLinkOpen(prev => ({ ...prev, [id]: false }))
    const { error } = await supabase.from('show_ideas').update({ url: url || null }).eq('id', id)
    if (error) {
      setIdeas(prev => prev.map(i => i.id === id ? { ...i, url: prevUrl } : i))
      showToast("Couldn't save — try again", true)
    }
  }

  const saveIdeaNotes = async (id: string, notes: string) => {
    const prevNotes = ideas.find(i => i.id === id)?.notes
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, notes } : i))
    const { error } = await supabase.from('show_ideas').update({ notes: notes || null }).eq('id', id)
    if (error) {
      setIdeas(prev => prev.map(i => i.id === id ? { ...i, notes: prevNotes } : i))
      showToast("Couldn't save — try again", true)
    }
  }

  const getDomain = (url: string) => {
    try { return new URL(url).hostname.replace('www.', '') }
    catch { return url.slice(0, 30) }
  }

  const addColumn = async () => {
    const { data } = await supabase.from('show_idea_columns').insert({ show_id: showId, title: 'New Column', order_index: columns.length }).select().single()
    if (data) setColumns(prev => [...prev, data])
  }

  const deleteColumn = async (id: string) => {
    const removedCol = columns.find(c => c.id === id)
    const removedIdeas = ideas.filter(i => i.column_id === id)
    setColumns(prev => prev.filter(c => c.id !== id))
    setIdeas(prev => prev.filter(i => i.column_id !== id))
    // Delete the column's ideas first so no orphan rows are left behind
    const { error: ideasError } = await supabase.from('show_ideas').delete().eq('column_id', id)
    if (ideasError) {
      if (removedCol) setColumns(prev => [...prev, removedCol])
      if (removedIdeas.length > 0) setIdeas(prev => [...prev, ...removedIdeas])
      showToast("Couldn't save — try again", true)
      return
    }
    const { error } = await supabase.from('show_idea_columns').delete().eq('id', id)
    if (error) {
      if (removedCol) setColumns(prev => [...prev, removedCol])
      showToast("Couldn't save — try again", true)
    }
  }

  const toggleColumnMode = async (id: string, current: string) => {
    const next = current === 'weekly' ? 'permanent' : 'weekly'
    setColumns(prev => prev.map(c => c.id === id ? { ...c, mode: next } : c))
    const { error } = await supabase.from('show_idea_columns').update({ mode: next }).eq('id', id)
    if (error) {
      setColumns(prev => prev.map(c => c.id === id ? { ...c, mode: current } : c))
      showToast("Couldn't save — try again", true)
    }
  }

  const updateColumnTitle = (id: string, title: string) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, title } : c))
  }

  const saveColumnTitle = async (id: string, title: string) => {
    const { error } = await supabase.from('show_idea_columns').update({ title }).eq('id', id)
    if (error) showToast("Couldn't save — try again", true)
  }

  const today = new Date().toLocaleDateString('en-CA')
  const isOnAir = currentEp?.episode_date === today

  const completedSections = sections.filter(s => getSectionStatus(s.name) === 'ready').length
  const completionPct = sections.length > 0 ? Math.round((completedSections / sections.length) * 100) : 0

  if (loading) return <PageLoader />

  const isRadio = ['radio', 'breakfast_radio', 'drive', 'evening'].includes(show?.show_type)
  const epLabel = isRadio ? 'Broadcast' : 'Episode'
  const epLabelPlural = isRadio ? 'broadcasts' : 'episodes'

  const hosts: Array<{ slot: 'host1' | 'host2' | 'producer'; name: string; avatar: string | null; color: string; label: string }> = ([
    { slot: 'host1' as const, name: show?.host1_name, avatar: show?.host1_avatar ?? null, color: '#00e5a0', label: 'Host 1' },
    { slot: 'host2' as const, name: show?.host2_name, avatar: show?.host2_avatar ?? null, color: '#ff5c3a', label: 'Host 2' },
    ...(show?.has_producer && show?.producer_name
      ? [{ slot: 'producer' as const, name: show.producer_name, avatar: show.producer_avatar ?? null, color: '#a78bfa', label: 'Producer' }]
      : [])
  ] as Array<{ slot: 'host1' | 'host2' | 'producer'; name: string; avatar: string | null; color: string; label: string }>).filter(h => h.name)

  const renderIdeasBoard = (columnsGridClass: string) => (
    <DndContext sensors={whiteboardSensors} collisionDetection={closestCenter} onDragEnd={handleColumnDndEnd}>
    <div className="space-y-3">
      <SortableContext items={columns.map(c => c.id)} strategy={rectSortingStrategy}>
      <div className={columnsGridClass}>
        {columns.map(col => {
          const colActive = ideas.filter(i => i.column_id === col.id && !i.done)
          const colDone = ideas.filter(i => i.column_id === col.id && i.done)
          const colText = newIdeaTextByCol[col.id] || ''
          return (
            <SortableIdeaItem key={col.id} id={col.id}>
            {(colDragListeners) => (
            <div className="bg-white border border-[#e2e4e8] rounded-2xl overflow-hidden flex flex-col">
              {/* Column header — drag handle + editable title + delete */}
              <div className="px-3 py-3 border-b border-[#e2e4e8] bg-[#f7f8fa] flex items-center gap-2 group/col">
                <span {...colDragListeners} className="text-[#c8cad0] hover:text-[#6b6b7a] cursor-grab active:cursor-grabbing flex-shrink-0 select-none touch-none flex items-center"><IconGrip size={13} /></span>
                <input
                  type="text"
                  value={col.title}
                  onChange={e => updateColumnTitle(col.id, e.target.value)}
                  onBlur={e => saveColumnTitle(col.id, e.target.value)}
                  onMouseDown={e => e.stopPropagation()}
                  className="flex-1 bg-transparent text-xs font-bold uppercase tracking-widest text-[#6b6b7a] outline-none"
                />
                <button
                  onClick={() => toggleColumnMode(col.id, col.mode || 'permanent')}
                  title={col.mode === 'weekly' ? 'Weekly: completed items auto-clear each Monday — click to switch to Permanent' : 'Permanent: items stay forever — click to switch to Weekly'}
                  className={`flex-shrink-0 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full transition-colors opacity-0 group-hover/col:opacity-100 ${
                    col.mode === 'weekly'
                      ? 'bg-[#a78bfa]/20 text-[#7c3aed] hover:bg-[#a78bfa]/35'
                      : 'bg-[#e2e4e8] text-[#9a9aaa] hover:bg-[#d8dae0] hover:text-[#6b6b7a]'
                  }`}
                >
                  {col.mode === 'weekly' ? <><IconRefresh size={11} /> Weekly</> : 'Permanent'}
                </button>
                {col.mode === 'weekly' && (
                  <span className="flex-shrink-0 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#a78bfa]/20 text-[#7c3aed] group-hover/col:hidden"><IconRefresh size={11} /> Weekly</span>
                )}
                {colDeleteConfirm === col.id ? (
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] text-[#6b6b7a]">Delete?</span>
                    <button onClick={() => { deleteColumn(col.id); setColDeleteConfirm(null) }}
                      className="text-[10px] font-bold text-white bg-[#ff5c3a] rounded px-1.5 py-0.5 hover:bg-red-600 transition-colors">Yes</button>
                    <button onClick={() => setColDeleteConfirm(null)}
                      className="text-[10px] text-[#6b6b7a] hover:text-[#0d0d0f] transition-colors">No</button>
                  </span>
                ) : (
                  <button onClick={() => setColDeleteConfirm(col.id)}
                    className="opacity-0 group-hover/col:opacity-100 text-[#c8cad0] hover:text-[#ff5c3a] transition-all flex-shrink-0 flex items-center"><IconX size={14} /></button>
                )}
              </div>
              {/* Add idea input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[#f0f1f3]">
                <div className="w-4 h-4 rounded-full border-2 border-[#e2e4e8] flex-shrink-0" />
                <input
                  type="text"
                  value={colText}
                  onChange={e => setNewIdeaTextByCol(prev => ({ ...prev, [col.id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') addIdea(col.id) }}
                  placeholder="Add an idea…"
                  className="flex-1 bg-transparent text-sm text-[#0d0d0f] outline-none placeholder-[#c8cad0]"
                />
                {colText.trim() && (
                  <button onClick={() => addIdea(col.id)} className="text-[#00a870] text-xs font-semibold flex-shrink-0">Add</button>
                )}
              </div>
              {/* Active ideas */}
              {colActive.length === 0 && colDone.length === 0 && (
                <div className="px-4 py-8 text-center text-[#c8cad0] text-xs">Nothing here yet</div>
              )}
              <DndContext sensors={whiteboardSensors} collisionDetection={closestCenter} onDragEnd={handleIdeaDndEnd}>
              <SortableContext items={colActive.map(i => i.id)} strategy={rectSortingStrategy}>
              {colActive.map(idea => (
                <SortableIdeaItem key={idea.id} id={idea.id}>
                {(dragListeners) => (
                <div className="border-b border-[#f0f1f3] group hover:bg-[#f7f8fa] transition-colors">
                  <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                    <span {...dragListeners} className="text-[#c8cad0] hover:text-[#6b6b7a] cursor-grab active:cursor-grabbing flex-shrink-0 select-none touch-none flex items-center"><IconGrip size={13} /></span>
                    <button onClick={() => toggleIdea(idea.id, true)}
                      className="w-4 h-4 rounded-full border-2 border-[#c8cad0] hover:border-[#00e5a0] transition-colors flex-shrink-0" />
                    <span className="flex-1 text-sm text-[#0d0d0f]">{idea.text}</span>
                    <button onClick={() => setIdeaNotesOpen(prev => ({ ...prev, [idea.id]: !prev[idea.id] }))}
                      className={`opacity-0 group-hover:opacity-100 text-[10px] border rounded-md px-1.5 py-0.5 transition-all flex-shrink-0 flex items-center gap-1 ${idea.notes ? 'opacity-100 text-[#6b6b7a] border-[#e2e4e8]' : 'text-[#c8cad0] border-transparent hover:border-[#e2e4e8] hover:text-[#6b6b7a]'}`}>
                      {ideaNotesOpen[idea.id] ? 'Hide' : <><IconPlus size={10} /> Note</>}
                    </button>
                    {ideaDeleteConfirm === idea.id ? (
                      <span className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] text-[#6b6b7a]">Delete?</span>
                        <button onClick={() => { deleteIdea(idea.id); setIdeaDeleteConfirm(null) }}
                          className="text-[10px] font-bold text-white bg-[#ff5c3a] rounded px-1.5 py-0.5 hover:bg-red-600 transition-colors">Yes</button>
                        <button onClick={() => setIdeaDeleteConfirm(null)}
                          className="text-[10px] text-[#6b6b7a] hover:text-[#0d0d0f] transition-colors">No</button>
                      </span>
                    ) : (
                      <button onClick={() => setIdeaDeleteConfirm(idea.id)}
                        className="opacity-0 group-hover:opacity-100 text-[#c8cad0] hover:text-[#ff5c3a] transition-all flex-shrink-0 flex items-center"><IconX size={14} /></button>
                    )}
                  </div>
                  {(ideaNotesOpen[idea.id] || idea.notes) && (
                    <div className="px-11 pb-2">
                      <textarea
                        value={idea.notes || ''}
                        onChange={e => setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, notes: e.target.value } : i))}
                        onBlur={e => saveIdeaNotes(idea.id, e.target.value)}
                        placeholder="Add notes…"
                        rows={2}
                        className="w-full bg-white border border-[#e2e4e8] rounded-lg px-3 py-2 text-xs text-[#4a4a5a] outline-none focus:border-[#00e5a0] resize-none placeholder-[#c8cad0]"
                      />
                    </div>
                  )}
                  {/* Link — always below notes */}
                  <div className="px-11 pb-2.5">
                    {idea.url ? (
                      <span className="flex items-center gap-1">
                        <a href={idea.url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-[#00a870] border border-[#00e5a0]/40 rounded-md px-1.5 py-0.5 hover:bg-[#00e5a0]/10 transition-colors max-w-[200px] flex items-center gap-1">
                          <IconLink size={12} className="flex-shrink-0" /> <span className="truncate">{getDomain(idea.url)}</span>
                        </a>
                        <button onClick={() => saveIdeaUrl(idea.id, '')}
                          className="opacity-0 group-hover:opacity-100 text-[#c8cad0] hover:text-[#ff5c3a] transition-all flex items-center"><IconX size={12} /></button>
                      </span>
                    ) : ideaLinkOpen[idea.id] ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          value={ideaLinkInput[idea.id] || ''}
                          onChange={e => setIdeaLinkInput(prev => ({ ...prev, [idea.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveIdeaUrl(idea.id, ideaLinkInput[idea.id] || '')
                            if (e.key === 'Escape') setIdeaLinkOpen(prev => ({ ...prev, [idea.id]: false }))
                          }}
                          placeholder="Paste a URL…"
                          autoFocus
                          className="flex-1 bg-white border border-[#e2e4e8] rounded-lg px-2.5 py-1 text-xs outline-none focus:border-[#00e5a0] placeholder-[#c8cad0]"
                        />
                        <button onClick={() => saveIdeaUrl(idea.id, ideaLinkInput[idea.id] || '')}
                          className="bg-[#00e5a0] text-black text-xs font-bold rounded-lg px-2.5 py-1 hover:bg-[#00ffc0] transition-colors">Save</button>
                        <button onClick={() => setIdeaLinkOpen(prev => ({ ...prev, [idea.id]: false }))}
                          className="text-[#6b6b7a] text-xs hover:text-[#0d0d0f] transition-colors">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => { setIdeaLinkOpen(prev => ({ ...prev, [idea.id]: true })); setIdeaLinkInput(prev => ({ ...prev, [idea.id]: '' })) }}
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-[#c8cad0] hover:text-[#00a870] transition-all flex items-center gap-1">
                        <IconPlus size={10} /> Add link
                      </button>
                    )}
                  </div>
                </div>
                )}
                </SortableIdeaItem>
              ))}
              </SortableContext>
              </DndContext>
              {/* Done section */}
              {colDone.length > 0 && (
                <>
                  <div className="px-4 py-1.5 bg-[#f7f8fa] border-t border-b border-[#e2e4e8]">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#c8cad0]">Done — {colDone.length}</span>
                  </div>
                  {colDone.map(idea => (
                    <div key={idea.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#f0f1f3] group hover:bg-[#f7f8fa] transition-colors opacity-50">
                      <button onClick={() => toggleIdea(idea.id, false)}
                        className="w-4 h-4 rounded-full bg-[#00e5a0] flex items-center justify-center flex-shrink-0 text-black">
                        <IconCheck size={10} strokeWidth={3} />
                      </button>
                      <span className="flex-1 text-sm text-[#6b6b7a] line-through">{idea.text}</span>
                      <button onClick={() => deleteIdea(idea.id)}
                        className="opacity-0 group-hover:opacity-100 text-[#c8cad0] hover:text-[#ff5c3a] transition-all flex-shrink-0 flex items-center"><IconX size={14} /></button>
                    </div>
                  ))}
                </>
              )}
            </div>
            )}
            </SortableIdeaItem>
          )
        })}
      </div>
      </SortableContext>
      {columns.length === 0 && (
        <div className="text-center py-14 bg-white border border-[#e2e4e8] rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-[#f7f8fa] border border-[#e2e4e8] flex items-center justify-center mx-auto mb-3 text-[#c8cad0]">
            <IconLightbulb size={28} />
          </div>
          <p className="text-[#6b6b7a] text-sm font-medium mb-1">No columns yet</p>
          <p className="text-[#c8cad0] text-xs mb-5">Add a column to start collecting and organising show ideas</p>
          <button onClick={addColumn} className="inline-flex items-center gap-1.5 bg-[#00e5a0] text-black font-semibold rounded-xl px-5 py-2 text-xs hover:bg-[#00d494] active:scale-[0.99] transition-all"><IconPlus size={13} /> Add first column</button>
        </div>
      )}
      {/* Add column */}
      {columns.length > 0 && (
        <button
          onClick={addColumn}
          className="w-full py-3 border-2 border-dashed border-[#e2e4e8] rounded-2xl text-sm text-[#c8cad0] hover:border-[#00e5a0]/50 hover:text-[#00a870] transition-colors flex items-center justify-center gap-1.5"
        ><IconPlus size={13} /> Add column</button>
      )}
    </div>
    </DndContext>
  )

  const renderWhiteboard = () => {
    if (!(currentEp && sections.length > 0)) return null
    return (
      <div className="rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
        style={{ border: '10px solid #2e2e2e', outline: '2px solid #3a3a3a' }}>
        <div className="h-3 flex items-center px-4 gap-1.5" style={{ background: '#252525' }}>
          {['#555','#444','#333'].map((c, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <div className="px-6 pt-5 pb-8"
          style={{ background: '#fafaf7', backgroundImage: 'repeating-linear-gradient(transparent, transparent 39px, #ece8e0 39px, #ece8e0 40px)' }}>
          <div className="flex items-center justify-between mb-8">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ color: '#b0a898' }}>
              {show?.name} — Episode Board
            </p>
            <a href={`/planner/${showId}?episodeId=${currentEp.id}`}
              className="text-[10px] border rounded-lg px-3 py-1 transition-colors hover:text-[#1a1a1a] flex items-center gap-1"
              style={{ color: '#9a9080', borderColor: '#d8d0c4' }}>
              Edit in planner <IconArrowRight size={11} />
            </a>
          </div>
          <DndContext sensors={whiteboardSensors} collisionDetection={closestCenter} onDragEnd={handleWhiteboardDndEnd}>
            <SortableContext items={sections.map((s: any) => s.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-9">
                {sections.map((section: any, idx: number) => {
                  const status = getSectionStatus(section.name)
                  const preview = getSectionPreview(section.name)
                  // Checkerboard across the 2-column grid so no column is a single colour
                  const checker = (Math.floor(idx / 2) + (idx % 2)) % 2
                  const noteColor = checker === 0 ? '#cdf0e3' : '#f0e2cc'
                  const href = `/planner/${showId}?episodeId=${currentEp.id}#${section.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
                  const badgeBg = status === 'ready' ? 'rgba(0,168,112,0.18)' : status === 'draft' ? 'rgba(245,194,66,0.22)' : 'rgba(0,0,0,0.10)'
                  const badgeColor = status === 'ready' ? '#005c38' : status === 'draft' ? '#7a5200' : 'rgba(0,0,0,0.38)'
                  return (
                    <SortableNote key={section.id} id={section.id}>
                      {(dragListeners: any) => (
                        <div className="relative">
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                            <div className="w-4 h-4 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${PIN_COLORS[checker]}, ${PIN_SHADOWS[checker]})`, border: '1px solid rgba(0,0,0,0.25)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                              <div className="w-1 h-1 rounded-full ml-[3px] mt-[3px]" style={{ background: 'rgba(255,255,255,0.5)' }} />
                            </div>
                          </div>
                          <span
                            {...dragListeners}
                            className="absolute top-2 right-2 z-20 text-[rgba(0,0,0,0.2)] hover:text-[rgba(0,0,0,0.45)] cursor-grab active:cursor-grabbing select-none touch-none flex items-center"
                            title="Drag to reorder"
                          ><IconGrip size={13} /></span>
                          <a href={href}
                            className="sticky-note block rounded-xl"
                            style={{ backgroundColor: noteColor, boxShadow: '0 1px 2px rgba(13,13,15,0.04), 0 2px 8px rgba(13,13,15,0.06)' }}>
                            <div className="pt-4 px-4 pb-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <p className="text-[8px] font-bold uppercase tracking-[0.16em] mb-1.5" style={{ color: 'rgba(0,0,0,0.25)' }}>
                                    Segment {idx + 1}
                                  </p>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-base leading-none">{section.icon}</span>
                                    <span className="font-bold text-[13px] leading-snug" style={{ color: '#1a1a1a' }}>{section.name}</span>
                                  </div>
                                </div>
                                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                                  style={{ backgroundColor: badgeBg, color: badgeColor }}>
                                  {status}
                                </span>
                              </div>
                              <p className="text-[11px] leading-relaxed line-clamp-4 mt-3" style={{ color: '#3a3028' }}>
                                {preview || <span className="italic" style={{ color: 'rgba(0,0,0,0.25)' }}>No notes yet</span>}
                              </p>
                            </div>
                          </a>
                        </div>
                      )}
                    </SortableNote>
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
        <div className="h-5" style={{ background: '#252525' }} />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#0d0d0f] animate-page-in">
      <Toast toast={toast} />
      {/* Nav */}
      <header className="bg-white border-b border-[#e2e4e8]">
        <div className="max-w-[2000px] mx-auto px-4 sm:px-8 lg:px-12 h-14 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <a href="/dashboard" className="text-[#6b6b7a] hover:text-[#0d0d0f] text-sm transition-colors whitespace-nowrap flex items-center gap-1"><IconArrowLeft size={14} /> <span className="hidden sm:inline">Dashboard</span></a>
          <span className="text-[#e2e4e8]">|</span>
          <Logo size={0.65} />
        </div>
        {show && (
          <div className="flex items-center gap-2">
            <GlobalSearch />
            {isOwner && <a href={`/show-settings/${showId}`} className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 text-sm hover:text-[#0d0d0f] transition-colors whitespace-nowrap">Settings</a>}
            {!isRadio && (
              <a href={`/planner/${showId}?new=true`} className="bg-[#00e5a0] text-black font-semibold rounded-lg px-3 sm:px-4 py-1.5 text-sm hover:bg-[#00d494] active:scale-[0.99] transition-all whitespace-nowrap flex items-center gap-1.5">
                <IconPlus size={14} /> <span className="hidden sm:inline">New {epLabel.toLowerCase()}</span><span className="sm:hidden">New</span>
              </a>
            )}
          </div>
        )}
        </div>
      </header>

      {/* ── Full-bleed show banner ── */}
      {show && (() => {
        const bannerColor = show.header_color || '#00e5a0'
        const onBanner = contrastText(bannerColor)
        const dark = onBanner === '#0d0d0f'
        const chipBg = dark ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.20)'
        const subtle = dark ? 'rgba(13,13,15,0.55)' : 'rgba(255,255,255,0.78)'
        const ring = dark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.35)'
        return (
          <div style={{ backgroundColor: bannerColor }} className="border-b border-black/10">
            <div className="max-w-[2000px] mx-auto px-4 sm:px-8 lg:px-12 py-5 flex items-center gap-4">
              {/* Logo */}
              <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-sm border border-white/25 bg-white/10">
                {show.logo_url ? (
                  <img src={show.logo_url} alt={show.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/90">
                    <span className="text-xl font-black" style={{ color: bannerColor }}>{getInitials(show.name || '')}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-2">
                  <h1 className="text-xl sm:text-2xl font-bold leading-tight truncate" style={{ color: onBanner }}>{show.name}</h1>
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: chipBg, color: onBanner }}>
                    {show.show_type === 'breakfast_radio' ? 'Breakfast'
                      : show.show_type === 'drive' ? 'Drive'
                      : show.show_type === 'evening' ? 'Evening'
                      : isRadio ? 'Radio'
                      : 'Podcast'}
                  </span>
                </div>
                {/* Host row with upload */}
                <div className="flex flex-wrap items-center gap-4">
                  {hosts.map(h => {
                    const inputKey = `${showId}-${h.slot}`
                    return (
                      <div key={h.slot} className="flex items-center gap-2 group/av cursor-pointer"
                        onClick={() => fileInputs.current[inputKey]?.click()}
                        title={`Upload ${h.name}'s photo`}>
                        <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-2" style={{ '--tw-ring-color': ring } as React.CSSProperties}>
                          {h.avatar
                            ? <img src={h.avatar} alt={h.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: h.color }}>{h.name?.[0]}</div>}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center text-white">
                            {uploading === inputKey ? <Spinner size={10} /> : <IconPencil size={10} />}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold leading-tight" style={{ color: onBanner }}>{h.name}</div>
                          <div className="text-[10px]" style={{ color: subtle }}>{h.label}</div>
                        </div>
                        <input ref={el => { fileInputs.current[inputKey] = el }} type="file" accept="image/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(h.slot, f) }} />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <div className="max-w-[2000px] mx-auto px-4 sm:px-8 lg:px-12 py-8 space-y-4">

        {/* ── Tab switcher (radio only) ── */}
        {isRadio && (
        <div className="flex gap-2 bg-white border border-[#e2e4e8] rounded-2xl p-1.5">
          <button
            onClick={() => setActiveTab('runsheet')}
            className={`flex-1 flex flex-col items-center gap-1 py-4 rounded-xl font-bold transition-all ${activeTab === 'runsheet' ? 'bg-[#00e5a0] text-black shadow-sm' : 'text-[#6b6b7a] hover:text-[#0d0d0f] hover:bg-[#f7f8fa]'}`}
          >
            {isRadio ? <IconClipboard size={20} /> : <IconMic size={20} />}
            <span className="text-sm tracking-wide">{isRadio ? 'Runsheet' : 'Episodes'}</span>
          </button>
          <button
            onClick={() => setActiveTab('ideas')}
            className={`flex-1 flex flex-col items-center gap-1 py-4 rounded-xl font-bold transition-all ${activeTab === 'ideas' ? 'bg-[#00e5a0] text-black shadow-sm' : 'text-[#6b6b7a] hover:text-[#0d0d0f] hover:bg-[#f7f8fa]'}`}
          >
            <IconLightbulb size={20} />
            <span className="text-sm tracking-wide">Ideas Board</span>
          </button>
        </div>
        )}

        {/* ── Radio: Current Runsheet card + Today's Show + Archive ── */}
        {isRadio && activeTab === 'runsheet' && (() => {
          const SLOT_KEYS = ['03', '10', '20', '33', '40', '5055']
          const HOURS = [6, 7, 8]
          const todayDow = new Date().getDay() // 0=Sun
          const isWeekday = todayDow >= 1 && todayDow <= 5
          const isSelectedToday = selectedDow === todayDow && isWeekday
          // compute the calendar date for the selected day-of-week in the current week
          const _wm = new Date()
          const _wd = _wm.getDay()
          _wm.setDate(_wm.getDate() + (_wd === 0 ? -6 : 1 - _wd))
          const _sd = new Date(_wm)
          _sd.setDate(_wm.getDate() + selectedDow - 1)
          const selectedDate = _sd.toLocaleDateString('en-CA')
          const currentSlots = weekSlots[selectedDate] || {}
          const totalSlots = SLOT_KEYS.length * HOURS.length
          const filledCount = HOURS.reduce((acc, h) =>
            acc + SLOT_KEYS.filter(k => currentSlots[`${h}-${k}`]?.title?.trim()).length, 0)
          const fillPct = Math.round((filledCount / totalSlots) * 100)

          const filteredWeeks = archiveSearch.trim()
            ? radioWeeks.filter(mondayStr => {
                const mon = new Date(mondayStr + 'T00:00:00')
                const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
                const lbl = `${mon.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} ${fri.toLocaleDateString('en-AU', { month: 'long' })}`
                return lbl.toLowerCase().includes(archiveSearch.toLowerCase())
              })
            : radioWeeks

          return (
            <>
              {/* Current Week card */}
              <div className="relative bg-white border border-[#e2e4e8] rounded-2xl px-6 py-5 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00e5a0] rounded-l-full" />
                <div className="flex items-start justify-between gap-4 pl-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#00a870] mb-1">Current Week</div>
                    <div className="text-xl font-bold text-[#0d0d0f] leading-snug">{currentWeekRange()}</div>
                    {/* Day pills */}
                    <div className="flex items-center gap-1.5 mt-3">
                      {['Mon','Tue','Wed','Thu','Fri'].map((d, i) => {
                        const dow = i + 1
                        const isSelected = selectedDow === dow
                        const isToday = isWeekday && todayDow === dow
                        return (
                          <button key={d} onClick={() => setSelectedDow(dow)} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                            isSelected
                              ? 'bg-[#00e5a0] text-black'
                              : isToday
                              ? 'bg-[#00e5a0]/20 text-[#00a870] border border-[#00e5a0]/40 hover:bg-[#00e5a0] hover:text-black'
                              : 'bg-[#f7f8fa] text-[#6b6b7a] border border-[#e2e4e8] hover:border-[#00e5a0]/40 hover:text-[#0d0d0f]'
                          }`}>{d}</button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0 mt-1">
                    <a href={`/radio-planner/${showId}`}
                      className="bg-[#00e5a0] text-black font-semibold rounded-xl px-5 py-2.5 text-sm hover:bg-[#00d494] active:scale-[0.99] transition-all shadow-sm flex items-center justify-center gap-1.5">
                      Open runsheet <IconArrowRight size={13} />
                    </a>
                    <a href={`/guests/${showId}`}
                      className="text-xs text-[#6b6b7a] border border-[#e2e4e8] rounded-xl px-4 py-2 hover:text-[#0d0d0f] hover:border-[#c8cad0] transition-colors flex items-center justify-center gap-1.5">
                      <IconUsers size={13} /> Guest book
                    </a>
                  </div>
                </div>
              </div>

              {/* Selected Day's Show grid */}
              <a href={`/radio-planner/${showId}?date=${selectedDate}`}
                className="block bg-white border border-[#e2e4e8] rounded-2xl overflow-hidden hover:border-[#00e5a0]/50 transition-colors group">
                {/* Header */}
                <div className="px-6 py-4 border-b border-[#e2e4e8]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-sm font-bold text-[#0d0d0f]">
                        {isSelectedToday ? "Today's Show" : ['Monday','Tuesday','Wednesday','Thursday','Friday'][selectedDow - 1]}
                      </span>
                      <span className="text-xs text-[#6b6b7a] truncate">
                        {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </span>
                      {isSelectedToday && (
                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest bg-[#ff5c3a]/10 text-[#ff5c3a] border border-[#ff5c3a]/20 rounded-full px-2 py-0.5 flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ff5c3a] animate-pulse" />
                          On Air
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        filledCount === totalSlots ? 'bg-[#00e5a0]/15 text-[#00a870]' :
                        filledCount > 0 ? 'bg-[#f7f8fa] text-[#6b6b7a] border border-[#e2e4e8]' :
                        'bg-[#f7f8fa] text-[#c8cad0] border border-[#e2e4e8]'
                      }`}>{filledCount}/{totalSlots} planned</span>
                      <span className="text-xs text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 group-hover:text-[#0d0d0f] group-hover:border-[#c8cad0] transition-colors flex items-center gap-1">
                        Open planner <IconArrowRight size={13} />
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-1 bg-[#f0f1f3] rounded-full overflow-hidden">
                    <div className="h-full bg-[#00e5a0] rounded-full transition-all duration-500"
                      style={{ width: `${fillPct}%` }} />
                  </div>
                </div>

                {/* 3-column hour grid */}
                <div className="grid grid-cols-3 divide-x divide-[#e2e4e8]">
                  {HOURS.map(hour => {
                    const slots = [
                      { slotKey: '03',   time: ':03', label: 'Top of Hour' },
                      { slotKey: '10',   time: ':10', label: 'Segment' },
                      { slotKey: '20',   time: ':20', label: 'Segment' },
                      { slotKey: '33',   time: ':33', label: 'Half Hour Intro' },
                      { slotKey: '40',   time: ':40', label: 'Segment', isInterview: true },
                      { slotKey: '5055', time: ':55', label: 'Segment' },
                    ]
                    const hourFilled = slots.filter(s => currentSlots[`${hour}-${s.slotKey}`]?.title?.trim()).length
                    return (
                      <div key={hour}>
                        {/* Hour header */}
                        <div className="px-4 py-2.5 border-b border-[#e2e4e8] bg-[#f7f8fa] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#00e5a0] flex-shrink-0" />
                            <span className="text-xs font-bold text-[#0d0d0f]">{hour}:00 AM</span>
                          </div>
                          <span className="text-[10px] text-[#c8cad0]">{hourFilled}/{slots.length}</span>
                        </div>
                        {/* Slot rows */}
                        <div className="divide-y divide-[#f0f1f3]">
                          {slots.map(s => {
                            const slotData = currentSlots[`${hour}-${s.slotKey}`]
                            const title = slotData?.title || ''
                            const notes = slotData?.notes || ''
                            const filled = title.trim().length > 0
                            const notesPreview = notes ? notes.split('\n')[0].slice(0, 60) : ''
                            return (
                              <div key={s.slotKey}
                                className={`flex items-start gap-2.5 px-4 py-2.5 ${filled ? 'bg-[#f5fdf9]' : ''}`}>
                                <span className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-black transition-all mt-0.5 ${
                                  filled
                                    ? 'bg-[#00e5a0] text-black shadow-[0_0_0_2px_rgba(0,229,160,0.2)]'
                                    : 'border-2 border-[#e2e4e8]'
                                }`}>
                                  {filled ? <IconCheck size={10} strokeWidth={3} /> : null}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline gap-1.5">
                                    <span className={`text-[10px] font-mono flex-shrink-0 ${filled ? 'text-[#00a870]' : 'text-[#c8cad0]'}`}>
                                      {s.time}
                                    </span>
                                    <span className={`text-xs truncate ${filled ? 'text-[#0d0d0f] font-semibold' : 'text-[#c8cad0]'}`}>
                                      {filled ? title : s.label}
                                    </span>
                                  </div>
                                  {filled && notesPreview && (
                                    <p className="text-[10px] text-[#9a9aaa] truncate mt-0.5 leading-tight">{notesPreview}</p>
                                  )}
                                </div>
                                {(s as any).isInterview && !filled && (
                                  <span className="text-[9px] font-medium text-[#f59e0b] flex-shrink-0 mt-0.5">Guest</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </a>

              {/* Broadcast Archive */}
              <div className="bg-white border border-[#e2e4e8] rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e2e4e8] flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold">Broadcast Archive</span>
                    <span className="text-xs text-[#6b6b7a] ml-2">{radioWeeks.length} {radioWeeks.length === 1 ? 'week' : 'weeks'}</span>
                  </div>
                </div>
                {/* Search */}
                {radioWeeks.length > 0 && (
                  <div className="px-6 py-3 border-b border-[#e2e4e8] relative">
                    <span className="absolute left-9.5 top-1/2 -translate-y-1/2 text-[#c8cad0] pointer-events-none flex items-center"><IconSearch size={14} /></span>
                    <input
                      type="text"
                      value={archiveSearch}
                      onChange={e => setArchiveSearch(e.target.value)}
                      placeholder="Search by month or year…"
                      className="w-full bg-[#f7f8fa] border border-[#e2e4e8] rounded-xl pl-8 pr-4 py-2 text-sm text-[#0d0d0f] outline-none focus:border-[#00e5a0] placeholder-[#c8cad0] transition-colors"
                    />
                    {archiveSearch && (
                      <button onClick={() => setArchiveSearch('')}
                        className="absolute right-9 top-1/2 -translate-y-1/2 text-[#c8cad0] hover:text-[#6b6b7a] flex items-center"><IconX size={14} /></button>
                    )}
                  </div>
                )}
                {radioWeeks.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-[#f7f8fa] border border-[#e2e4e8] flex items-center justify-center mx-auto mb-3 text-[#c8cad0]">
                      <IconRadio size={28} />
                    </div>
                    <p className="text-[#6b6b7a] text-sm font-medium mb-1">No runsheets yet</p>
                    <p className="text-[#c8cad0] text-xs mb-4">Fill in your first week of segments to see it here.</p>
                    <a href={`/planner/${showId}?new=true`} className="inline-flex items-center gap-1 bg-[#00e5a0] text-black font-semibold rounded-xl px-5 py-2 text-xs hover:bg-[#00d494] active:scale-[0.99] transition-all">
                      Open planner <IconArrowRight size={13} />
                    </a>
                  </div>
                ) : filteredWeeks.length === 0 ? (
                  <div className="px-6 py-10 text-center text-[#6b6b7a] text-sm">No weeks match "{archiveSearch}"</div>
                ) : (
                  <div className="divide-y divide-[#e2e4e8]">
                    {filteredWeeks.map((mondayStr, idx) => {
                      const mon = new Date(mondayStr + 'T00:00:00')
                      const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
                      const dateLabel = `${mon.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${fri.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      const isThisWeek = idx === 0 && !archiveSearch
                      return (
                        <a key={mondayStr} href={`/radio-planner/${showId}`}
                          className="flex items-center justify-between px-6 py-3.5 hover:bg-[#f7f8fa] transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-[#f7f8fa] border border-[#e2e4e8] flex items-center justify-center text-[#6b6b7a] flex-shrink-0 group-hover:border-[#00e5a0]/40 transition-colors">
                              <IconRadio size={14} />
                            </div>
                            <div>
                              <div className="font-medium text-sm text-[#0d0d0f] group-hover:text-[#00a870] transition-colors">
                                {dateLabel}
                              </div>
                              {isThisWeek && (
                                <div className="text-[10px] text-[#00a870] font-semibold mt-0.5">This week</div>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1">
                            Open <IconArrowRight size={13} />
                          </span>
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )
        })()}

        {/* ── Radio: Ideas Board ── */}
        {isRadio && activeTab === 'ideas' && (
          renderIdeasBoard('grid grid-cols-1 sm:grid-cols-2 gap-3')
        )}

        {/* ── Podcast: Current Episode + Whiteboard + Ideas Board + Archive ── */}
        {!isRadio && (
          <>
            {currentEp ? (
              <div className="relative bg-gradient-to-r from-[#edfdf6] to-white border border-[#00e5a0]/40 rounded-2xl px-6 py-5 flex items-center justify-between overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00e5a0] rounded-l-2xl" />
                <div className="pl-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#00a870]">Current Episode</div>
                    {isOnAir && (
                      <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest bg-[#ff5c3a]/10 text-[#ff5c3a] border border-[#ff5c3a]/20 rounded-full px-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5c3a] animate-pulse" />
                        On Air
                      </span>
                    )}
                    {!isOnAir && sections.length > 0 && completionPct > 0 && (
                      <span className="text-[9px] font-semibold text-[#6b6b7a] bg-[#f7f8fa] border border-[#e2e4e8] rounded-full px-2 py-0.5">
                        In Progress
                      </span>
                    )}
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold leading-tight truncate">{currentEp.title || `Untitled ${epLabel}`}</div>
                  <div className="text-sm text-[#6b6b7a] mt-1">{formatDate(currentEp.episode_date)}</div>
                  {sections.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-[#6b6b7a]">{completedSections}/{sections.length} sections complete</span>
                        <span className="text-[10px] font-semibold text-[#00a870]">{completionPct}%</span>
                      </div>
                      <div className="h-1.5 bg-[#e2e4e8] rounded-full overflow-hidden">
                        <div className="h-full bg-[#00e5a0] rounded-full transition-all duration-500" style={{ width: `${completionPct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                <a href={`/planner/${showId}?episodeId=${currentEp.id}`}
                  className="ml-6 bg-[#00e5a0] text-black font-semibold rounded-xl px-8 py-4 text-base hover:bg-[#00d494] active:scale-[0.99] transition-all flex-shrink-0 shadow-sm flex items-center gap-2">
                  Open planner <IconArrowRight size={16} />
                </a>
              </div>
            ) : (
              <div className="bg-white border-2 border-dashed border-[#e2e4e8] rounded-2xl px-6 py-8 flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#f7f8fa] border border-[#e2e4e8] flex items-center justify-center text-[#c8cad0]">
                  <IconMic size={28} />
                </div>
                <div>
                  <p className="font-semibold text-[#0d0d0f]">No active episode</p>
                  <p className="text-sm text-[#6b6b7a] mt-0.5">
                    {episodes.some((e: any) => e.archived) ? 'Last episode was archived.' : `No ${epLabelPlural} yet.`}
                    {' '}Start a new one to begin planning.
                  </p>
                </div>
                <a href={`/planner/${showId}?new=true`} className="bg-[#00e5a0] text-black font-semibold rounded-xl px-6 py-2.5 text-sm hover:bg-[#00d494] active:scale-[0.99] transition-all flex items-center gap-1.5">
                  <IconPlus size={14} /> New {epLabel.toLowerCase()}
                </a>
              </div>
            )}

            {/* Whiteboard + Ideas Board side by side */}
            {(() => {
              const wb = renderWhiteboard()
              return wb ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                  <div>{wb}</div>
                  <div>{renderIdeasBoard('grid grid-cols-1 gap-3')}</div>
                </div>
              ) : (
                renderIdeasBoard('grid grid-cols-1 sm:grid-cols-2 gap-3')
              )
            })()}

            {/* Episode Archive */}
            <a
              href={`/archive/${showId}`}
              className="bg-white border border-[#e2e4e8] rounded-2xl px-6 py-5 flex items-center justify-between hover:border-[#00e5a0] hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#f7f8fa] border border-[#e2e4e8] flex items-center justify-center text-[#6b6b7a] flex-shrink-0 group-hover:border-[#00e5a0]/40 transition-colors">
                  <IconArchive size={18} />
                </div>
                <div>
                  <div className="font-semibold text-sm text-[#0d0d0f] group-hover:text-[#00a870] transition-colors">Episode Archive</div>
                  <div className="text-xs text-[#6b6b7a] mt-0.5">{episodes.length} {epLabelPlural} total</div>
                </div>
              </div>
              <span className="text-xs text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 group-hover:border-[#00e5a0]/40 transition-colors flex items-center gap-1">View all <IconArrowRight size={13} /></span>
            </a>
          </>
        )}

      </div>
    </main>
  )
}
