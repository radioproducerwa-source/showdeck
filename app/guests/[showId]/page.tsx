'use client'
import { useEffect, useState, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Logo from '../../../components/Logo'
import GlobalSearch from '../../../components/GlobalSearch'

type Guest = {
  id: string
  name: string
  title: string
  phone: string
  email: string
  notes: string
}

type Toast = { msg: string; phase: 'in' | 'out' } | null

const EMPTY_FORM = { name: '', title: '', phone: '', email: '', notes: '' }

export default function GuestsPage({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = use(params)
  const [show, setShow] = useState<any>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM })
  const [toast, setToast] = useState<Toast>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<any>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      Promise.all([
        supabase.from('shows').select('id, name, show_type').eq('id', showId).single(),
        supabase.from('guests').select('*').eq('show_id', showId).order('name', { ascending: true }),
      ]).then(([{ data: showData }, { data: guestData }]) => {
        if (!showData) { router.push('/dashboard'); return }
        setShow(showData)
        setGuests(guestData || [])
        setLoading(false)
      })
    })
  }, [])

  const showToast = (msg: string) => {
    clearTimeout(toastTimer.current)
    setToast({ msg, phase: 'in' })
    toastTimer.current = setTimeout(() => {
      setToast(t => t ? { ...t, phase: 'out' } : null)
      toastTimer.current = setTimeout(() => setToast(null), 220)
    }, 1800)
  }

  const openAdd = () => {
    setAdding(true)
    setForm({ ...EMPTY_FORM })
    setTimeout(() => nameRef.current?.focus(), 40)
  }

  const cancelAdd = () => { setAdding(false); setForm({ ...EMPTY_FORM }) }

  const saveGuest = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('guests').insert({
      show_id: showId,
      name: form.name.trim(),
      title: form.title.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    }).select().single()
    setSaving(false)
    if (error) { showToast('Save failed'); return }
    setGuests(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setAdding(false)
    setForm({ ...EMPTY_FORM })
    showToast('Guest added')
  }

  const startEdit = (guest: Guest) => {
    setEditingId(guest.id)
    setEditForm({ name: guest.name, title: guest.title || '', phone: guest.phone || '', email: guest.email || '', notes: guest.notes || '' })
  }

  const cancelEdit = () => { setEditingId(null) }

  const saveEdit = async (id: string) => {
    if (!editForm.name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('guests').update({
      name: editForm.name.trim(),
      title: editForm.title.trim() || null,
      phone: editForm.phone.trim() || null,
      email: editForm.email.trim() || null,
      notes: editForm.notes.trim() || null,
    }).eq('id', id)
    setSaving(false)
    if (error) { showToast('Save failed'); return }
    setGuests(prev =>
      prev.map(g => g.id === id ? { ...g, ...editForm } : g).sort((a, b) => a.name.localeCompare(b.name))
    )
    setEditingId(null)
    showToast('Guest updated')
  }

  const deleteGuest = async (id: string) => {
    await supabase.from('guests').delete().eq('id', id)
    setGuests(prev => prev.filter(g => g.id !== id))
    setDeleteConfirm(null)
    showToast('Guest removed')
  }

  const filtered = guests.filter(g => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return g.name.toLowerCase().includes(q) ||
      (g.title || '').toLowerCase().includes(q) ||
      (g.email || '').toLowerCase().includes(q)
  })

  if (loading) return <div className="min-h-screen bg-[#f7f8fa]" />

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#0d0d0f] animate-page-in">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#0d0d0f] text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl pointer-events-none ${
          toast.phase === 'in' ? 'animate-toast-in' : 'animate-toast-out'
        }`}>
          <span className="w-4 h-4 rounded-full bg-[#00e5a0] flex items-center justify-center text-black text-[9px] font-black">✓</span>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-[#e2e4e8] px-6 h-14 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <a href={`/shows/${showId}`} className="text-[#6b6b7a] hover:text-[#0d0d0f] text-sm transition-colors">← Show</a>
          <span className="text-[#e2e4e8]">|</span>
          <Logo size={0.65} />
          <span className="text-[#6b6b7a] text-xs border-l border-[#e2e4e8] pl-3">{show?.name}</span>
        </div>
        <GlobalSearch />
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Guest Address Book</h1>
            <p className="text-sm text-[#6b6b7a] mt-0.5">{guests.length} {guests.length === 1 ? 'guest' : 'guests'} saved</p>
          </div>
          {!adding && (
            <button
              onClick={openAdd}
              className="bg-[#00e5a0] text-black font-bold rounded-xl px-5 py-2.5 text-sm hover:bg-[#00ffc0] transition-colors"
            >
              + Add Guest
            </button>
          )}
        </div>

        {/* Add guest form */}
        {adding && (
          <div className="bg-white border-2 border-[#00e5a0] rounded-2xl p-5 mb-4">
            <div className="text-xs font-bold uppercase tracking-widest text-[#00a870] mb-4">New Guest</div>
            <GuestForm
              form={form}
              setForm={setForm}
              nameRef={nameRef}
              onSave={saveGuest}
              onCancel={cancelAdd}
              saving={saving}
            />
          </div>
        )}

        {/* Search */}
        {guests.length > 3 && (
          <div className="relative mb-4">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c8cad0] text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search guests…"
              className="w-full bg-white border border-[#e2e4e8] rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#00e5a0] placeholder-[#c8cad0]"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#c8cad0] hover:text-[#6b6b7a] text-lg leading-none">×</button>
            )}
          </div>
        )}

        {/* Guest list */}
        {filtered.length === 0 && !adding ? (
          <div className="bg-white border border-[#e2e4e8] rounded-2xl px-6 py-16 text-center">
            <div className="text-4xl mb-3">🎤</div>
            <p className="font-semibold text-[#0d0d0f] mb-1">{search ? `No guests match "${search}"` : 'No guests yet'}</p>
            {!search && <p className="text-sm text-[#6b6b7a]">Add guests to your address book to quickly drop them into interview slots.</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(guest => (
              <div key={guest.id} className="bg-white border border-[#e2e4e8] rounded-2xl overflow-hidden group">
                {editingId === guest.id ? (
                  <div className="p-5">
                    <div className="text-xs font-bold uppercase tracking-widest text-[#6b6b7a] mb-4">Editing</div>
                    <GuestForm
                      form={editForm}
                      setForm={setEditForm}
                      onSave={() => saveEdit(guest.id)}
                      onCancel={cancelEdit}
                      saving={saving}
                    />
                  </div>
                ) : (
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {/* Name + title */}
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-bold text-[#0d0d0f]">{guest.name}</span>
                          {guest.title && (
                            <span className="text-xs text-[#6b6b7a] truncate">{guest.title}</span>
                          )}
                        </div>
                        {/* Contact row */}
                        {(guest.phone || guest.email) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                            {guest.phone && (
                              <a href={`tel:${guest.phone}`} className="text-xs text-[#6b6b7a] hover:text-[#0d0d0f] transition-colors flex items-center gap-1">
                                <span className="text-[10px]">📞</span>{guest.phone}
                              </a>
                            )}
                            {guest.email && (
                              <a href={`mailto:${guest.email}`} className="text-xs text-[#6b6b7a] hover:text-[#0d0d0f] transition-colors flex items-center gap-1">
                                <span className="text-[10px]">✉️</span>{guest.email}
                              </a>
                            )}
                          </div>
                        )}
                        {/* Notes */}
                        {guest.notes && (
                          <p className="text-xs text-[#9a9aaa] mt-2 leading-relaxed line-clamp-2">{guest.notes}</p>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(guest)}
                          className="text-xs text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-3 py-1.5 hover:text-[#0d0d0f] hover:border-[#c8cad0] transition-colors"
                        >Edit</button>
                        {deleteConfirm === guest.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-[#ff5c3a]">Delete?</span>
                            <button onClick={() => deleteGuest(guest.id)} className="text-xs text-white bg-[#ff5c3a] rounded-lg px-2.5 py-1.5 hover:bg-[#ff3a1a] transition-colors">Yes</button>
                            <button onClick={() => setDeleteConfirm(null)} className="text-xs text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-2.5 py-1.5 hover:border-[#c8cad0] transition-colors">No</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(guest.id)}
                            className="text-[#c8cad0] hover:text-[#ff5c3a] text-xl leading-none transition-colors"
                            title="Delete guest"
                          >×</button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

type FormFields = { name: string; title: string; phone: string; email: string; notes: string }

function GuestForm({ form, setForm, nameRef, onSave, onCancel, saving }: {
  form: FormFields
  setForm: (f: FormFields) => void
  nameRef?: React.RefObject<HTMLInputElement | null>
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  const field = (key: keyof FormFields, label: string, placeholder: string, type = 'text') => (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b7a] mb-1 block">{label}</label>
      <input
        ref={key === 'name' ? nameRef : undefined}
        type={type}
        value={form[key]}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        onKeyDown={e => { if (e.key === 'Enter' && key !== 'notes') onSave() }}
        className="w-full bg-[#f7f8fa] border border-[#e2e4e8] rounded-lg px-3 py-2 text-sm text-[#0d0d0f] outline-none focus:border-[#00e5a0] placeholder-[#c8cad0] transition-colors"
      />
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {field('name', 'Name *', 'Guest name')}
        {field('title', 'Title / Role', 'e.g. Author, Comedian, CEO')}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field('phone', 'Phone', '+61 4xx xxx xxx', 'tel')}
        {field('email', 'Email', 'guest@example.com', 'email')}
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b7a] mb-1 block">Notes</label>
        <textarea
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          placeholder="Topics, past appearances, talking points…"
          rows={2}
          className="w-full bg-[#f7f8fa] border border-[#e2e4e8] rounded-lg px-3 py-2 text-sm text-[#0d0d0f] outline-none focus:border-[#00e5a0] placeholder-[#c8cad0] resize-none transition-colors"
        />
      </div>
      <div className="flex items-center gap-2 justify-end pt-1">
        <button onClick={onCancel} className="text-sm text-[#6b6b7a] border border-[#e2e4e8] rounded-xl px-4 py-2 hover:border-[#c8cad0] transition-colors">
          Cancel
        </button>
        <button onClick={onSave} disabled={saving || !form.name.trim()}
          className="text-sm bg-[#00e5a0] text-black font-bold rounded-xl px-5 py-2 hover:bg-[#00ffc0] transition-colors disabled:opacity-40">
          {saving ? 'Saving…' : 'Save Guest'}
        </button>
      </div>
    </div>
  )
}
