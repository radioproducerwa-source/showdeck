'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

type SlotTemplate = {
  slotTime: string | null
  label: string
  isFixed: boolean
  isInterview: boolean
  slotKey: string
}

const HOUR_TEMPLATE: SlotTemplate[] = [
  { slotTime: ':03',     label: 'TOP OF HOUR',   isFixed: false, isInterview: false, slotKey: '03' },
  { slotTime: null,      label: 'SONG ×1',        isFixed: true,  isInterview: false, slotKey: 'song-a' },
  { slotTime: ':10',     label: 'SEGMENT',        isFixed: false, isInterview: false, slotKey: '10' },
  { slotTime: null,      label: 'Traffic / Ads',  isFixed: true,  isInterview: false, slotKey: 'traffic-a' },
  { slotTime: null,      label: 'SONG ×1',        isFixed: true,  isInterview: false, slotKey: 'song-b' },
  { slotTime: ':20',     label: 'SEGMENT',        isFixed: false, isInterview: false, slotKey: '20' },
  { slotTime: null,      label: 'Traffic / Ads',  isFixed: true,  isInterview: false, slotKey: 'traffic-b' },
  { slotTime: null,      label: 'News',           isFixed: true,  isInterview: false, slotKey: 'news' },
  { slotTime: ':33',     label: 'HALF HOUR INTRO',isFixed: false, isInterview: false, slotKey: '33' },
  { slotTime: null,      label: 'SONG ×1',        isFixed: true,  isInterview: false, slotKey: 'song-c' },
  { slotTime: ':40',     label: 'SEGMENT',        isFixed: false, isInterview: true,  slotKey: '40' },
  { slotTime: null,      label: 'Traffic / Ads',  isFixed: true,  isInterview: false, slotKey: 'traffic-c' },
  { slotTime: null,      label: 'SONG ×2',        isFixed: true,  isInterview: false, slotKey: 'song-d' },
  { slotTime: ':55',     label: 'SEGMENT',        isFixed: false, isInterview: false, slotKey: '5055' },
  { slotTime: null,      label: 'ADS',            isFixed: true,  isInterview: false, slotKey: 'ads' },
]

const HOURS = [6, 7, 8]
const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const ADDABLE_SLOT_TYPES: SlotTemplate[] = [
  { label: 'SEGMENT',        isFixed: false, isInterview: false, slotTime: null, slotKey: '' },
  { label: 'INTERVIEW',      isFixed: false, isInterview: true,  slotTime: null, slotKey: '' },
  { label: 'News',           isFixed: true,  isInterview: false, slotTime: null, slotKey: '' },
  { label: 'SONG ×1',       isFixed: true,  isInterview: false, slotTime: null, slotKey: '' },
  { label: 'Traffic / Ads', isFixed: true,  isInterview: false, slotTime: null, slotKey: '' },
  { label: 'ADS',            isFixed: true,  isInterview: false, slotTime: null, slotKey: '' },
]


type SlotData          = { title: string; notes: string; link: string }
type PlanMap           = Record<string, SlotData>
type Toast             = { msg: string; phase: 'in' | 'out' } | null
type Guest             = { id: string; name: string; title: string | null; notes: string | null }
type RecurringSegment  = { id: string; name: string }

function getMondayOf(d: Date): Date {
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  monday.setHours(0, 0, 0, 0)
  return monday
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toISODate(d: Date): string {
  return d.toLocaleDateString('en-CA')
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function formatWeekRange(monday: Date): string {
  const fri = addDays(monday, 4)
  return `${monday.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${fri.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onMouseDown={e => e.stopPropagation()}
      onClick={copy}
      tabIndex={-1}
      className={`pr-1.5 text-[10px] font-semibold leading-none flex-shrink-0 transition-colors ${copied ? 'text-[#00a870]' : 'text-[#c8cad0] hover:text-[#6b6b7a]'}`}
    >
      {copied ? '✓' : 'copy'}
    </button>
  )
}

type Props = { showId: string; show: any }

export default function RadioPlannerPanel({ showId, show }: Props) {
  const [monday, setMonday]           = useState<Date>(getMondayOf(new Date()))
  const [selectedDay, setSelectedDay] = useState<number>(Math.min(Math.max(new Date().getDay() - 1, 0), 4))
  const [plans, setPlans]             = useState<Record<string, PlanMap>>({})
  const [saving, setSaving]           = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [toast, setToast]             = useState<Toast>(null)
  const [dragSrc, setDragSrc]         = useState<{ hour: number; slotKey: string } | null>(null)
  const [dragOver, setDragOver]       = useState<{ hour: number; slotKey: string } | null>(null)
  const [slotLayout, setSlotLayout]             = useState<SlotTemplate[]>(HOUR_TEMPLATE)
  const [editingLayout, setEditingLayout]       = useState(false)
  const [guests, setGuests]                     = useState<Guest[]>([])
  const [recurringSegments, setRecurringSegments] = useState<RecurringSegment[]>([])
  const [guestPicker, setGuestPicker]           = useState<{ hour: number; slotKey: string } | null>(null)
  const [guestSearch, setGuestSearch]           = useState('')
  const saveTimers   = useRef<Record<string, any>>({})
  const toastTimer   = useRef<any>(null)
  const linkFocusRef = useRef<string | null>(null)

  useEffect(() => {
    loadDay(toISODate(addDays(getMondayOf(new Date()), selectedDay)))
  }, [])

  useEffect(() => {
    loadDay(currentDate())
  }, [monday, selectedDay])

  const currentDate = () => toISODate(addDays(monday, selectedDay))

  const showToast = (msg: string) => {
    clearTimeout(toastTimer.current)
    setToast({ msg, phase: 'in' })
    toastTimer.current = setTimeout(() => {
      setToast(t => t ? { ...t, phase: 'out' } : null)
      toastTimer.current = setTimeout(() => setToast(null), 220)
    }, 1800)
  }

  const loadDay = async (date: string) => {
    if (plans[date]) return
    try {
      const { data } = await supabase
        .from('radio_plans')
        .select('*')
        .eq('show_id', showId)
        .eq('plan_date', date)

      if (data && data.length > 0) {
        const map: PlanMap = {}
        data.forEach((r: any) => {
          map[`${r.hour}-${r.slot_key}`] = { title: r.title || '', notes: r.notes || '', link: r.link || '' }
        })
        setPlans(prev => ({ ...prev, [date]: map }))
      } else {
        // No saved plan — try template for this day of week
        const dayName = DOW_NAMES[new Date(date + 'T12:00:00').getDay()]
        const { data: tmpl } = await supabase
          .from('radio_templates')
          .select('hour, slot_time, title, notes')
          .eq('show_id', showId)
          .eq('day_of_week', dayName)
        const map: PlanMap = {}
        ;(tmpl || []).forEach((r: any) => {
          map[`${r.hour}-${r.slot_time}`] = { title: r.title || '', notes: r.notes || '', link: '' }
        })
        setPlans(prev => ({ ...prev, [date]: map }))
      }
    } catch {
      setPlans(prev => ({ ...prev, [date]: {} }))
    }
  }

  const getSlot = (date: string, hour: number, slotKey: string): SlotData =>
    plans[date]?.[`${hour}-${slotKey}`] || { title: '', notes: '', link: '' }

  const updateSlot = (date: string, hour: number, slotKey: string, field: 'title' | 'notes' | 'link', value: string) => {
    setPlans(prev => {
      const dayMap = { ...(prev[date] || {}) }
      const existing = dayMap[`${hour}-${slotKey}`] || { title: '', notes: '', link: '' }
      dayMap[`${hour}-${slotKey}`] = { ...existing, [field]: value }
      return { ...prev, [date]: dayMap }
    })
    const timerKey = `${date}-${hour}-${slotKey}-${field}`
    clearTimeout(saveTimers.current[timerKey])
    saveTimers.current[timerKey] = setTimeout(async () => {
      setSaving(true)
      const slot = getSlot(date, hour, slotKey)
      const updated = { ...slot, [field]: value }
      try {
        await supabase.from('radio_plans').upsert({
          show_id: showId,
          plan_date: date,
          hour,
          slot_key: slotKey,
          title: updated.title,
          notes: updated.notes,
          link: updated.link,
        }, { onConflict: 'show_id,plan_date,hour,slot_key' })
      } catch { /* table not yet created */ }
      setSaving(false)
      showToast('Saved')
    }, 700)
  }

  const handleSlotDragStart = (e: React.DragEvent, hour: number, slotKey: string) => {
    setDragSrc({ hour, slotKey })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleSlotDragOver = (e: React.DragEvent, hour: number, slotKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver({ hour, slotKey })
  }

  const handleSlotDrop = (e: React.DragEvent, hour: number, slotKey: string) => {
    e.preventDefault()
    if (!dragSrc || (dragSrc.hour === hour && dragSrc.slotKey === slotKey)) {
      setDragSrc(null); setDragOver(null); return
    }
    const date = currentDate()
    const srcData = getSlot(date, dragSrc.hour, dragSrc.slotKey)
    const dstData = getSlot(date, hour, slotKey)
    setPlans(prev => {
      const dayMap = { ...(prev[date] || {}) }
      dayMap[`${dragSrc.hour}-${dragSrc.slotKey}`] = { ...dstData }
      dayMap[`${hour}-${slotKey}`] = { ...srcData }
      return { ...prev, [date]: dayMap }
    })
    const save = async (h: number, sk: string, data: SlotData) => {
      try {
        await supabase.from('radio_plans').upsert({
          show_id: showId, plan_date: date, hour: h, slot_key: sk,
          title: data.title, notes: data.notes, link: data.link,
        }, { onConflict: 'show_id,plan_date,hour,slot_key' })
      } catch { /* ignore */ }
    }
    setSaving(true)
    Promise.all([
      save(dragSrc.hour, dragSrc.slotKey, dstData),
      save(hour, slotKey, srcData),
    ]).then(() => { setSaving(false); showToast('Saved') })
    setDragSrc(null); setDragOver(null)
  }

  const handleSlotDragEnd = () => { setDragSrc(null); setDragOver(null) }

  useEffect(() => {
    supabase.from('guests').select('id, name, title, notes').eq('show_id', showId).order('name').then(({ data }) => {
      if (data) setGuests(data)
    })
    supabase.from('recurring_segments').select('id, name').eq('show_id', showId).order('created_at').then(({ data }) => {
      if (data) setRecurringSegments(data)
    })
    supabase.from('show_slot_layout').select('*').eq('show_id', showId).order('sort_order').then(({ data }) => {
      if (data && data.length > 0) {
        setSlotLayout(data.map((r: any) => ({
          slotKey:     r.slot_key,
          label:       r.label,
          slotTime:    r.slot_time ?? null,
          isFixed:     r.is_fixed,
          isInterview: r.is_interview,
        })))
      }
    })
  }, [])

  const openGuestPicker = (hour: number, slotKey: string) => {
    setGuestSearch('')
    setGuestPicker({ hour, slotKey })
  }

  const pickGuest = (guest: Guest) => {
    if (!guestPicker) return
    const { hour, slotKey } = guestPicker
    const date = currentDate()
    updateSlot(date, hour, slotKey, 'title', guest.name)
    if (guest.title) updateSlot(date, hour, slotKey, 'notes', guest.title)
    setGuestPicker(null)
  }

  const persistLayout = async (layout: SlotTemplate[]) => {
    await supabase.from('show_slot_layout').delete().eq('show_id', showId)
    if (layout.length > 0) {
      await supabase.from('show_slot_layout').insert(
        layout.map((s, i) => ({
          show_id:      showId,
          slot_key:     s.slotKey,
          label:        s.label,
          slot_time:    s.slotTime ?? null,
          is_fixed:     s.isFixed,
          is_interview: s.isInterview,
          sort_order:   i,
        }))
      )
    }
  }

  const deleteSlotFromLayout = async (slotKey: string) => {
    const updated = slotLayout.filter(s => s.slotKey !== slotKey)
    setSlotLayout(updated)
    await persistLayout(updated)
  }

  const addSlotToLayout = async (type: SlotTemplate) => {
    const newSlot: SlotTemplate = {
      ...type,
      slotKey: `custom-${Date.now()}`,
    }
    const updated = [...slotLayout, newSlot]
    setSlotLayout(updated)
    await persistLayout(updated)
  }

  const saveAsTemplate = async () => {
    setSavingTemplate(true)
    const date = currentDate()
    const dayName = DOW_NAMES[new Date(date + 'T12:00:00').getDay()]
    const rows = HOURS.flatMap(hour =>
      slotLayout
        .filter(slot => !slot.isFixed)
        .map(slot => {
          const sd = getSlot(date, hour, slot.slotKey)
          return {
            show_id: showId,
            day_of_week: dayName,
            slot_time: slot.slotKey,
            hour,
            slot_type: slot.label,
            title: sd.title || null,
            notes: sd.notes || null,
            is_fixed: false,
          }
        })
    )
    await supabase.from('radio_templates').delete().eq('show_id', showId).eq('day_of_week', dayName)
    const { error } = await supabase.from('radio_templates').insert(rows)
    setSavingTemplate(false)
    showToast(error ? 'Failed to save template' : 'Template saved')
  }

  const exportPdf = async () => {
    const date = currentDate()
    const dayName = addDays(monday, selectedDay).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pw = 297; const ph = 210; const ml = 12; const mr = 12; const mt = 20
    const colW = (pw - ml - mr - 8) / 3

    doc.setFillColor(13, 13, 15)
    doc.rect(0, 0, pw, 14, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(0, 229, 160)
    doc.text('SHOWDECK  ·  RADIO RUNSHEET', ml, 9)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 160)
    doc.text(`${show?.name || ''}  ·  ${dayName}`, pw - mr, 9, { align: 'right' })

    const colX = (i: number) => ml + i * (colW + 4)
    HOURS.forEach((hour, i) => {
      doc.setFillColor(247, 248, 250)
      doc.rect(colX(i), mt - 4, colW, 8, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(0, 168, 112)
      doc.text(`${hour}AM`, colX(i) + colW / 2, mt + 1, { align: 'center' })
    })

    let ys = [mt + 8, mt + 8, mt + 8]
    slotLayout.forEach(slot => {
      HOURS.forEach((hour, i) => {
        const x = colX(i)
        let y = ys[i]
        if (slot.isFixed) {
          doc.setFillColor(240, 240, 244)
          doc.rect(x, y, colW, 6, 'F')
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(7.5)
          doc.setTextColor(160, 162, 170)
          doc.text(slot.label, x + 2, y + 4)
          ys[i] += 7
        } else {
          const sd = getSlot(date, hour, slot.slotKey)
          const rowH = sd.notes ? 18 : 11
          doc.setFillColor(255, 255, 255)
          doc.rect(x, y, colW, rowH, 'FD')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7)
          doc.setTextColor(0, 200, 140)
          doc.text(slot.slotTime || '', x + 2, y + 4.5)
          doc.setFontSize(8.5)
          doc.setTextColor(30, 32, 40)
          const titleX = x + (slot.slotTime ? doc.getTextWidth(slot.slotTime || '') + 4 : 2)
          doc.text(sd.title || slot.label, titleX, y + 4.5, { maxWidth: colW - titleX + x - 2 })
          if (sd.notes) {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7.5)
            doc.setTextColor(80, 82, 90)
            doc.text(doc.splitTextToSize(sd.notes, colW - 4).slice(0, 2), x + 2, y + 9)
          }
          ys[i] += rowH + 1
        }
      })
    })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(160)
    doc.text(`Generated by Showdeck · ${new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, ml, ph - 4)
    doc.save(`radio-runsheet-${date}.pdf`)
  }

  const date = currentDate()
  const dayDates = Array.from({ length: 5 }, (_, i) => addDays(monday, i))

  return (
    <div className="rounded-2xl border border-[#e2e4e8] bg-white overflow-hidden">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#0d0d0f] text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl pointer-events-none ${
          toast.phase === 'in' ? 'animate-toast-in' : 'animate-toast-out'
        }`}>
          <span className="w-4 h-4 rounded-full bg-[#00e5a0] flex items-center justify-center text-black text-[9px] font-black">✓</span>
          {toast.msg}
        </div>
      )}

      {/* Panel header */}
      <div className="px-5 py-3.5 border-b border-[#e2e4e8] flex items-center justify-between bg-[#f7f8fa]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#0d0d0f]">📻 Radio Runsheet</span>
          {saving && <span className="text-xs text-[#6b6b7a]">Saving…</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditingLayout(v => !v)}
            className={`border rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
              editingLayout
                ? 'border-[#f59e0b] bg-[#fef3c7] text-[#b45309]'
                : 'border-[#e2e4e8] text-[#6b6b7a] hover:text-[#0d0d0f] hover:border-[#c8cad0]'
            }`}
          >
            {editingLayout ? 'Done' : 'Edit layout'}
          </button>
          <button
            onClick={saveAsTemplate}
            disabled={savingTemplate}
            className="border border-[#e2e4e8] text-[#6b6b7a] hover:text-[#0d0d0f] hover:border-[#c8cad0] rounded-lg px-4 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
          >
            {savingTemplate ? 'Saving…' : 'Save as Template'}
          </button>
          <button
            onClick={exportPdf}
            className="border border-[#e2e4e8] text-[#6b6b7a] hover:text-[#0d0d0f] hover:border-[#c8cad0] rounded-lg px-4 py-1.5 text-xs font-medium transition-colors"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Week carousel */}
      <div className="px-5 py-3 border-b border-[#e2e4e8] flex items-center gap-3 bg-white">
        <button
          onClick={() => setMonday(m => addDays(m, -7))}
          className="w-9 h-9 rounded-lg border-2 border-[#c8cad0] bg-white hover:border-[#0d0d0f] hover:text-[#0d0d0f] flex items-center justify-center transition-all text-base font-bold text-[#6b6b7a] flex-shrink-0 shadow-sm"
        >‹</button>
        <span className="text-xs text-[#6b6b7a] flex-shrink-0 w-44">{formatWeekRange(monday)}</span>
        <div className="flex gap-1 flex-1">
          {DAYS.map((day, i) => {
            const isToday = toISODate(dayDates[i]) === toISODate(new Date())
            const isSelected = i === selectedDay
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(i)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isSelected
                    ? 'bg-[#00e5a0] text-black'
                    : 'text-[#6b6b7a] hover:bg-[#f7f8fa]'
                }`}
              >
                <div>{day}</div>
                <div className={`text-[10px] font-normal ${isSelected ? 'text-black/50' : isToday ? 'text-[#00a870]' : 'text-[#c8cad0]'}`}>
                  {formatDayLabel(dayDates[i])}
                </div>
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setMonday(m => addDays(m, 7))}
          className="w-9 h-9 rounded-lg border-2 border-[#c8cad0] bg-white hover:border-[#0d0d0f] hover:text-[#0d0d0f] flex items-center justify-center transition-all text-base font-bold text-[#6b6b7a] flex-shrink-0 shadow-sm"
        >›</button>
        <button
          onClick={() => { setMonday(getMondayOf(new Date())); setSelectedDay(Math.min(Math.max(new Date().getDay() - 1, 0), 4)) }}
          className="text-xs text-[#6b6b7a] hover:text-[#0d0d0f] border border-[#e2e4e8] rounded-lg px-3 py-1.5 transition-colors flex-shrink-0"
        >This week</button>
      </div>

      {/* 3-column runsheet */}
      <div className="px-5 py-5 overflow-x-auto bg-[#f7f8fa]">
        <div className="grid grid-cols-3 gap-4 min-w-[820px]">
          {HOURS.map(hour => (
            <div key={hour} className="flex flex-col">
              {/* Hour header */}
              <div className="rounded-xl mb-3 px-5 py-4 flex items-center justify-between"
                style={{ background: 'linear-gradient(135deg, #0d0d0f 60%, #1a2a20)', border: '1px solid #1a1a1a' }}>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#00e5a0' }}>On Air</div>
                  <div className="text-4xl font-black leading-none" style={{ color: '#00e5a0' }}>
                    {hour}AM
                  </div>
                </div>
                <div className="text-4xl opacity-30">📻</div>
              </div>

              {/* Slots */}
              <div className="flex flex-col gap-1.5">
                {slotLayout.map(slot => {
                  if (slot.isFixed) {
                    return (
                      <div
                        key={slot.slotKey}
                        className="px-3 py-1.5 rounded-lg text-xs italic border-l-4 border-[#d0d4da] border border-[#e8eaed] flex items-center justify-between"
                        style={{
                          color: '#a0a4ae',
                          background: 'repeating-linear-gradient(45deg, #f4f5f8, #f4f5f8 5px, #edeef2 5px, #edeef2 10px)',
                        }}
                      >
                        <span>{slot.label}</span>
                        {editingLayout && hour === HOURS[0] && (
                          <button
                            onClick={() => deleteSlotFromLayout(slot.slotKey)}
                            className="text-[#c8cad0] hover:text-[#e53935] transition-colors text-[10px] leading-none ml-2 flex-shrink-0"
                          >✕</button>
                        )}
                      </div>
                    )
                  }

                  const sd = getSlot(date, hour, slot.slotKey)
                  const hasContent = sd.title || sd.notes
                  const defaultTitle = ''
                  const isDragSrc = dragSrc?.hour === hour && dragSrc?.slotKey === slot.slotKey
                  const isDragOver = dragOver?.hour === hour && dragOver?.slotKey === slot.slotKey

                  return (
                    <div
                      key={slot.slotKey}
                      draggable
                      onDragStart={e => handleSlotDragStart(e, hour, slot.slotKey)}
                      onDragOver={e => handleSlotDragOver(e, hour, slot.slotKey)}
                      onDrop={e => handleSlotDrop(e, hour, slot.slotKey)}
                      onDragEnd={handleSlotDragEnd}
                      className="rounded-xl overflow-hidden transition-all"
                      style={{
                        background: '#ffffff',
                        border: isDragOver ? '1.5px solid #00e5a0' : hasContent ? '1px solid rgba(0,229,160,0.45)' : '1px solid #e2e4e8',
                        opacity: isDragSrc ? 0.45 : 1,
                        cursor: 'grab',
                      }}
                    >
                      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                        <span className="text-[12px] text-[#c8cad0] flex-shrink-0 cursor-grab select-none" title="Drag to swap">⠿</span>
                        {slot.slotTime && (
                          <span className="text-[10px] font-bold text-[#00a870] flex-shrink-0 font-mono">{slot.slotTime}</span>
                        )}
                        <span className="text-[10px] text-[#6b6b7a] uppercase tracking-widest">{slot.label}</span>
                        {editingLayout && hour === HOURS[0] ? (
                          <button
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); deleteSlotFromLayout(slot.slotKey) }}
                            className="ml-auto text-[#c8cad0] hover:text-[#e53935] transition-colors text-[10px] leading-none flex-shrink-0 px-1"
                            style={{ cursor: 'pointer' }}
                          >✕</button>
                        ) : (
                          <button
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); openGuestPicker(hour, slot.slotKey) }}
                            className="ml-auto text-[9px] font-semibold text-[#00a870] border border-[#00e5a0]/40 rounded-md px-1.5 py-0.5 hover:bg-[#00e5a0]/10 transition-colors flex-shrink-0"
                            style={{ cursor: 'pointer' }}
                          >
                            📋 Guests
                          </button>
                        )}
                      </div>
                      {!slot.isInterview && (
                        <select
                          value=""
                          onChange={e => { if (e.target.value) updateSlot(date, hour, slot.slotKey, 'title', e.target.value) }}
                          onMouseDown={e => e.stopPropagation()}
                          className="w-full bg-transparent border-t border-[#f0f0f4] text-[10px] text-[#9a9aaa] px-3 py-1 outline-none cursor-pointer hover:bg-[#f7f8fa] transition-colors"
                          style={{ appearance: 'none' }}
                        >
                          <option value="">— Quick fill —</option>
                          {recurringSegments.length === 0
                            ? <option value="" disabled>Add segments in Show Settings</option>
                            : recurringSegments.map(s => <option key={s.id} value={s.name}>{s.name}</option>)
                          }
                        </select>
                      )}
                      <input
                        type="text"
                        value={sd.title}
                        onChange={e => updateSlot(date, hour, slot.slotKey, 'title', e.target.value)}
                        placeholder={defaultTitle || (slot.isInterview ? 'Guest name…' : 'Title…')}
                        className="w-full bg-transparent text-sm text-[#0d0d0f] font-semibold px-3 py-1 outline-none placeholder-[#c8cad0]"
                        style={{ cursor: 'text' }}
                        onMouseDown={e => e.stopPropagation()}
                      />
                      <textarea
                        value={sd.notes}
                        onChange={e => updateSlot(date, hour, slot.slotKey, 'notes', e.target.value)}
                        placeholder={slot.isInterview ? 'Topic / talking points…' : 'Notes…'}
                        rows={2}
                        className="w-full bg-transparent text-xs text-[#6b6b7a] px-3 pb-1 outline-none resize-none placeholder-[#c8cad0]"
                        style={{ cursor: 'text' }}
                        onMouseDown={e => e.stopPropagation()}
                      />
                      {(sd.link === '' ? [''] : sd.link.split('\n')).map((linkVal, idx, arr) => {
                        const focusKey = `${hour}-${slot.slotKey}-link-${idx}`
                        const removeLink = () => {
                          const links = sd.link === '' ? [''] : sd.link.split('\n')
                          if (links.length === 1) {
                            updateSlot(date, hour, slot.slotKey, 'link', '')
                          } else {
                            links.splice(idx, 1)
                            updateSlot(date, hour, slot.slotKey, 'link', links.join('\n'))
                          }
                        }
                        return (
                          <div key={idx} className={`flex items-center border-t border-[#f0f0f4] ${idx === arr.length - 1 ? 'pb-2.5' : ''}`}>
                            <input
                              type="text"
                              value={linkVal}
                              ref={el => {
                                if (el && linkFocusRef.current === focusKey) {
                                  el.focus()
                                  linkFocusRef.current = null
                                }
                              }}
                              onChange={e => {
                                const links = sd.link === '' ? [''] : sd.link.split('\n')
                                links[idx] = e.target.value
                                updateSlot(date, hour, slot.slotKey, 'link', links.join('\n'))
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  const links = sd.link === '' ? [''] : sd.link.split('\n')
                                  links.splice(idx + 1, 0, '')
                                  linkFocusRef.current = `${hour}-${slot.slotKey}-link-${idx + 1}`
                                  updateSlot(date, hour, slot.slotKey, 'link', links.join('\n'))
                                }
                              }}
                              placeholder="Audio / Web Link…"
                              className="flex-1 bg-transparent text-xs text-[#6b6b7a] px-3 py-1 outline-none placeholder-[#c8cad0]"
                              style={{ cursor: 'text' }}
                              onMouseDown={e => e.stopPropagation()}
                            />
                            {linkVal && (
                              <CopyButton value={linkVal} />
                            )}
                            {(arr.length > 1 || linkVal) && (
                              <button
                                onMouseDown={e => e.stopPropagation()}
                                onClick={removeLink}
                                className="pr-2.5 text-[#c8cad0] hover:text-[#e53935] transition-colors text-[10px] leading-none flex-shrink-0"
                                tabIndex={-1}
                              >✕</button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add slot row (edit mode only) */}
      {editingLayout && (
        <div className="px-5 py-3 border-t border-[#e2e4e8] bg-[#fffbeb]">
          <p className="text-[10px] text-[#b45309] font-semibold uppercase tracking-widest mb-2">Add slot to all hours</p>
          <div className="flex flex-wrap gap-2">
            {ADDABLE_SLOT_TYPES.map(type => (
              <button
                key={type.label}
                onClick={() => addSlotToLayout(type)}
                className="border border-[#e2e4e8] bg-white text-[#6b6b7a] hover:border-[#0d0d0f] hover:text-[#0d0d0f] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              >
                + {type.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Showdeck branding footer */}
      <div className="px-5 py-3 border-t border-[#e2e4e8] flex items-center justify-between">
        <a href={`/guests/${showId}`} className="text-[10px] text-[#c8cad0] hover:text-[#6b6b7a] transition-colors">
          🎤 Guest address book →
        </a>
        <span className="text-[10px] font-bold tracking-widest text-[#c8cad0] uppercase">Powered by Showdeck</span>
      </div>

      {/* Guest picker modal */}
      {guestPicker && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
          style={{ background: 'rgba(13,13,15,0.5)', backdropFilter: 'blur(3px)' }}
          onClick={() => setGuestPicker(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3.5 border-b border-[#e2e4e8]">
              <div className="text-xs font-bold uppercase tracking-widest text-[#00a870] mb-2.5">Select a Guest</div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c8cad0] text-xs">🔍</span>
                <input
                  autoFocus
                  type="text"
                  value={guestSearch}
                  onChange={e => setGuestSearch(e.target.value)}
                  placeholder="Search guests…"
                  className="w-full bg-[#f7f8fa] border border-[#e2e4e8] rounded-lg pl-7 pr-3 py-2 text-sm outline-none focus:border-[#00e5a0] placeholder-[#c8cad0]"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {(() => {
                const q = guestSearch.trim().toLowerCase()
                const visible = guests.filter(g =>
                  !q || g.name.toLowerCase().includes(q) || (g.title || '').toLowerCase().includes(q)
                )
                if (guests.length === 0) return (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-[#6b6b7a] mb-2">No guests saved yet.</p>
                    <a href={`/guests/${showId}`} className="text-xs text-[#00a870] hover:underline">Add guests to address book →</a>
                  </div>
                )
                if (visible.length === 0) return (
                  <div className="px-4 py-6 text-center text-sm text-[#6b6b7a]">No guests match "{guestSearch}"</div>
                )
                return (
                  <ul className="py-1.5">
                    {visible.map(guest => (
                      <li key={guest.id}>
                        <button
                          onClick={() => pickGuest(guest)}
                          className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-[#f7f8fa] text-left transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-[#00e5a0]/15 flex items-center justify-center flex-shrink-0 text-sm font-bold text-[#00a870]">
                            {guest.name[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[#0d0d0f]">{guest.name}</div>
                            {guest.title && <div className="text-xs text-[#6b6b7a] truncate">{guest.title}</div>}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              })()}
            </div>
            <div className="px-4 py-3 border-t border-[#e2e4e8] flex items-center justify-between">
              <a href={`/guests/${showId}`} className="text-xs text-[#6b6b7a] hover:text-[#00a870] transition-colors">+ Manage address book</a>
              <button onClick={() => setGuestPicker(null)} className="text-xs text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 hover:border-[#c8cad0] transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
