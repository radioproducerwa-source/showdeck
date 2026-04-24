'use client'
import { useEffect, useState, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Logo from '../../../components/Logo'
import GlobalSearch from '../../../components/GlobalSearch'

type Toast = { msg: string; phase: 'in' | 'out' } | null

const HEADER_COLORS = [
  { value: '#00e5a0', label: 'Green' },
  { value: '#0d0d0f', label: 'Black' },
  { value: '#e53935', label: 'Red' },
  { value: '#1e88e5', label: 'Blue' },
  { value: '#f9a825', label: 'Yellow' },
]

export default function ShowSettings({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = use(params)
  const [show, setShow] = useState<any>(null)
  const [showName, setShowName] = useState('')
  const [host1, setHost1] = useState('')
  const [host2, setHost2] = useState('')
  const [hasProducer, setHasProducer] = useState(false)
  const [producer, setProducer] = useState('')
  const [instagram, setInstagram] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [facebook, setFacebook] = useState('')
  const [xTwitter, setXTwitter] = useState('')
  const [youtube, setYoutube] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const [headerColor, setHeaderColor] = useState('#00e5a0')
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const toastTimer = useRef<any>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      supabase.from('shows').select('*').eq('id', showId).single().then(({ data: showData }) => {
        if (!showData || showData.owner_id !== data.user!.id) { router.push('/dashboard'); return }
        setShow(showData)
        setShowName(showData.name || '')
        setHost1(showData.host1_name || '')
        setHost2(showData.host2_name || '')
        setHasProducer(!!showData.has_producer)
        setProducer(showData.producer_name || '')
        setInstagram(showData.instagram || '')
        setTiktok(showData.tiktok || '')
        setFacebook(showData.facebook || '')
        setXTwitter(showData.x_twitter || '')
        setYoutube(showData.youtube || '')
        setHeaderColor(showData.header_color || '#00e5a0')
      })
    })
  }, [])

  const showToast = (msg: string, isError = false) => {
    clearTimeout(toastTimer.current)
    setToast({ msg, phase: 'in' })
    toastTimer.current = setTimeout(() => {
      setToast(t => t ? { ...t, phase: 'out' } : null)
      toastTimer.current = setTimeout(() => setToast(null), 220)
    }, isError ? 3000 : 1800)
  }

  const handleSave = async () => {
    if (!showName.trim() || !host1.trim() || !host2.trim()) {
      showToast('Show name and both hosts are required', true)
      return
    }
    setSaving(true)
    const { error } = await supabase.from('shows').update({
      name: showName.trim(),
      host1_name: host1.trim(),
      host2_name: host2.trim(),
      has_producer: hasProducer,
      producer_name: hasProducer ? producer.trim() : null,
      header_color: headerColor,
    }).eq('id', showId)
    setSaving(false)
    if (error) {
      showToast('Save failed: ' + error.message, true)
    } else {
      setShow((prev: any) => ({ ...prev, name: showName.trim(), host1_name: host1.trim(), host2_name: host2.trim(), has_producer: hasProducer, producer_name: hasProducer ? producer.trim() : null }))
      showToast('Settings saved!')
    }
  }

  const uploadAvatar = async (slot: 'host1' | 'host2' | 'producer' | 'logo', file: File) => {
    setUploading(slot)
    const ext = file.name.split('.').pop()
    const path = slot === 'logo' ? `${showId}.${ext}` : `${showId}-${slot}.${ext}`
    const { error: uploadError } = await supabase.storage.from('show-logos').upload(path, file, { upsert: true })
    if (uploadError) { showToast('Upload failed: ' + uploadError.message, true); setUploading(null); return }
    const { data: { publicUrl } } = supabase.storage.from('show-logos').getPublicUrl(path)
    const field = slot === 'logo' ? 'logo_url' : slot === 'host1' ? 'host1_avatar' : slot === 'host2' ? 'host2_avatar' : 'producer_avatar'
    await supabase.from('shows').update({ [field]: publicUrl }).eq('id', showId)
    setShow((prev: any) => ({ ...prev, [field]: publicUrl }))
    setUploading(null)
    showToast('Photo updated!')
  }

  if (!show) return <div className="min-h-screen bg-white" />

  const AvatarUpload = ({ slot, name, avatar, color }: { slot: 'host1' | 'host2' | 'producer' | 'logo'; name: string; avatar: string | null; color: string }) => (
    <div className="flex items-center gap-3">
      <div
        className={`${slot === 'logo' ? 'w-14 h-14 rounded-xl' : 'w-10 h-10 rounded-full'} overflow-hidden flex-shrink-0 border border-[#e2e4e8] bg-white flex items-center justify-center cursor-pointer hover:border-[#00e5a0] transition-colors group relative`}
        onClick={() => fileInputs.current[slot]?.click()}
        title={`Upload ${name} photo`}
      >
        {avatar
          ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
          : <div className={`w-full h-full ${color} flex items-center justify-center text-black text-sm font-bold`}>{slot === 'logo' ? '🎙️' : name?.[0]}</div>
        }
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white text-xs font-bold">{uploading === slot ? '…' : '↑'}</span>
        </div>
        <input ref={el => { fileInputs.current[slot] = el }} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(slot, f) }} />
      </div>
      <div>
        <div className="text-sm font-semibold">{name}</div>
        <div className="text-xs text-[#6b6b7a]">Click to {avatar ? 'replace' : 'upload'} photo</div>
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-white text-[#0d0d0f] p-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#0d0d0f] text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl pointer-events-none ${
          toast.phase === 'in' ? 'animate-toast-in' : 'animate-toast-out'
        }`}>
          <span className="w-4 h-4 rounded-full bg-[#00e5a0] flex items-center justify-center text-black text-[9px] font-black flex-shrink-0">✓</span>
          {toast.msg}
        </div>
      )}

      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-4">
            <a href={`/shows/${showId}`} className="text-[#6b6b7a] hover:text-[#0d0d0f] text-sm transition-colors">← Show</a>
            <Logo size={0.7} />
          </div>
          <GlobalSearch />
        </div>

        <h1 className="text-2xl font-bold mb-1">Show Settings</h1>
        <p className="text-[#6b6b7a] text-sm mb-8">{show.name}</p>

        <div className="bg-[#f7f8fa] border border-[#e2e4e8] rounded-2xl p-6 flex flex-col gap-6">
          {/* Show Name */}
          <div>
            <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">Show Name</label>
            <input type="text" value={showName} onChange={e => setShowName(e.target.value)}
              className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]" />
          </div>

          {/* Logo */}
          <div>
            <label className="text-[#6b6b7a] text-xs uppercase tracking-widest mb-3 block">Show Logo</label>
            <AvatarUpload slot="logo" name="Show Logo" avatar={show.logo_url} color="bg-[#e2e4e8]" />
          </div>

          {/* Hosts */}
          <div className="border-t border-[#e2e4e8] pt-4">
            <label className="text-[#6b6b7a] text-xs uppercase tracking-widest mb-4 block">Hosts</label>
            <div className="flex flex-col gap-5">
              <div>
                <div className="text-xs text-[#6b6b7a] mb-2">Host 1</div>
                <input type="text" value={host1} onChange={e => setHost1(e.target.value)}
                  className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-2.5 text-sm outline-none focus:border-[#00e5a0] mb-3" />
                <AvatarUpload slot="host1" name={host1 || 'Host 1'} avatar={show.host1_avatar} color="bg-[#00e5a0]" />
              </div>
              <div>
                <div className="text-xs text-[#6b6b7a] mb-2">Host 2</div>
                <input type="text" value={host2} onChange={e => setHost2(e.target.value)}
                  className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-2.5 text-sm outline-none focus:border-[#00e5a0] mb-3" />
                <AvatarUpload slot="host2" name={host2 || 'Host 2'} avatar={show.host2_avatar} color="bg-[#ff5c3a]" />
              </div>
            </div>
          </div>

          {/* Producer */}
          <div className="border-t border-[#e2e4e8] pt-4">
            <div className="flex items-center gap-3 cursor-pointer mb-3" onClick={() => setHasProducer(p => !p)}>
              <div className={`w-9 h-5 rounded-full relative transition-colors ${hasProducer ? 'bg-[#a78bfa]' : 'bg-[#e2e4e8]'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${hasProducer ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-[#6b6b7a]">Include a Producer role</span>
            </div>
            {hasProducer && (
              <div className="mt-3 flex flex-col gap-3">
                <input type="text" value={producer} onChange={e => setProducer(e.target.value)}
                  className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-2.5 text-sm outline-none focus:border-[#a78bfa]"
                  placeholder="Producer name" />
                <AvatarUpload slot="producer" name={producer || 'Producer'} avatar={show.producer_avatar} color="bg-[#a78bfa]" />
              </div>
            )}
          </div>

          {/* Social Media */}
          <div className="border-t border-[#e2e4e8] pt-4">
            <label className="text-[#6b6b7a] text-xs uppercase tracking-widest mb-4 block">Social Media</label>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Instagram', value: instagram, set: setInstagram, color: '#E1306C', placeholder: '@yourhandle' },
                { label: 'TikTok',    value: tiktok,    set: setTiktok,    color: '#000000', placeholder: '@yourhandle' },
                { label: 'Facebook',  value: facebook,  set: setFacebook,  color: '#1877F2', placeholder: 'Page name or URL' },
                { label: 'X',         value: xTwitter,  set: setXTwitter,  color: '#000000', placeholder: '@yourhandle' },
                { label: 'YouTube',   value: youtube,   set: setYoutube,   color: '#FF0000', placeholder: 'Channel name or URL' },
              ].map(({ label, value, set, color, placeholder }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-20 flex-shrink-0 flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-semibold text-[#0d0d0f]">{label}</span>
                  </div>
                  <input
                    type="text" value={value} onChange={e => set(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-3 py-2 text-sm outline-none focus:border-[#00e5a0]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Header Colour */}
          <div className="border-t border-[#e2e4e8] pt-4">
            <label className="text-[#6b6b7a] text-xs uppercase tracking-widest mb-1 block">Header Colour</label>
            <p className="text-[10px] text-[#9a9aaa] mb-4">Sets the banner colour on your show page.</p>
            <div className="flex gap-3 flex-wrap">
              {HEADER_COLORS.map(({ value, label }) => {
                const isSelected = headerColor === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setHeaderColor(value)}
                    title={label}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${
                      isSelected ? 'border-[#00e5a0] bg-[#f0fff8]' : 'border-[#e2e4e8] bg-white hover:border-[#c8cad0]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: value }} />
                    <span className="text-[9px] font-semibold text-[#6b6b7a]">{label}</span>
                    {isSelected && (
                      <div className="w-3 h-3 rounded-full bg-[#00e5a0] flex items-center justify-center">
                        <span className="text-black text-[7px] font-black">✓</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full bg-[#00e5a0] text-black font-bold rounded-xl py-3 text-sm tracking-widest hover:bg-[#00ffc0] transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>
    </main>
  )
}
