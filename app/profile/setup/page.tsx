'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { LogoIcon } from '../../../components/Logo'

const ROLES = [
  { value: 'host',        label: 'Host',           icon: '🎙️' },
  { value: 'co-host',     label: 'Co-Host',        icon: '🎙️' },
  { value: 'presenter',   label: 'Presenter',      icon: '🎤' },
  { value: 'producer',    label: 'Producer',       icon: '🎛️' },
  { value: 'newsreader',  label: 'Newsreader',     icon: '📰' },
  { value: 'journalist',  label: 'Journalist',     icon: '📝' },
  { value: 'engineer',    label: 'Sound Engineer', icon: '🎧' },
  { value: 'researcher',  label: 'Researcher',     icon: '🔍' },
  { value: 'other',       label: 'Other',          icon: '👤' },
]

export default function ProfileSetup() {
  const [user, setUser] = useState<any>(null)
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement | null>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      setUser(data.user)
      // Pre-fill name from email if available
      const emailName = data.user.email?.split('@')[0].replace(/[._-]/g, ' ')
      if (emailName) setDisplayName(emailName.replace(/\b\w/g, c => c.toUpperCase()))
    })
  }, [])

  const uploadAvatar = async (file: File) => {
    if (!user) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `profile-${user.id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('show-logos').upload(path, file, { upsert: true })
    if (uploadError) { alert('Upload failed: ' + uploadError.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('show-logos').getPublicUrl(path)
    setAvatarUrl(publicUrl)
    setUploading(false)
  }

  const handleSave = async () => {
    if (!displayName.trim()) { setError('Please enter your name'); return }
    if (!role) { setError('Please choose a role'); return }
    setSaving(true)
    const { error: saveError } = await supabase.from('profiles').upsert({
      id: user.id,
      display_name: displayName.trim(),
      role,
      avatar_url: avatarUrl,
    })
    if (saveError) { setError(saveError.message); setSaving(false); return }
    window.location.href = '/dashboard'
  }

  if (!user) return <div className="min-h-screen bg-[#f7f8fa]" />

  return (
    <main className="min-h-screen flex">

      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-[460px] flex-shrink-0 bg-[#0d0d0f] p-12 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-auto">
          <LogoIcon size={28} />
          <span className="text-white font-bold text-xl tracking-[0.2em]" style={{ fontFamily: 'monospace' }}>SHOWDECK</span>
        </div>
        <div className="mt-auto">
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">Almost there.</h2>
          <p className="text-white/50 text-sm leading-relaxed mb-10">
            Tell us a bit about yourself so your team knows who they're collaborating with.
          </p>
          <div className="flex flex-col gap-4">
            {[
              { icon: '👤', text: 'Your name appears on every runsheet' },
              { icon: '🎭', text: 'Your role helps teammates understand your part in the show' },
              { icon: '📸', text: 'A photo makes collaboration feel personal' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#00e5a0]/10 flex items-center justify-center flex-shrink-0 text-base">{icon}</div>
                <span className="text-white/60 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute -bottom-16 -right-16 opacity-[0.04] pointer-events-none">
          <LogoIcon size={320} />
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#f7f8fa]">
        <div className="bg-white border border-[#e2e4e8] rounded-2xl p-10 w-full max-w-lg shadow-sm">
          <h2 className="text-xl font-bold mb-1">Set up your profile</h2>
          <p className="text-[#6b6b7a] text-sm mb-8">This only takes a moment</p>

          {/* Avatar upload */}
          <div className="flex items-center gap-5 mb-8">
            <div
              className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0 border-2 border-[#e2e4e8] bg-[#f7f8fa] flex items-center justify-center cursor-pointer hover:border-[#00e5a0] transition-colors group"
              onClick={() => fileInput.current?.click()}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-3xl">{displayName?.[0]?.toUpperCase() || '?'}</span>}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                <span className="text-white text-xs font-bold">{uploading ? '…' : '↑'}</span>
              </div>
              <input ref={fileInput} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }} />
            </div>
            <div>
              <p className="text-sm font-semibold mb-0.5">Profile photo</p>
              <p className="text-xs text-[#6b6b7a]">Click to upload — optional but recommended</p>
            </div>
          </div>

          {/* Display name */}
          <div className="mb-6">
            <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">Your Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. Matt Thompson"
              className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
            />
          </div>

          {/* Role selector */}
          <div className="mb-8">
            <label className="text-[#6b6b7a] text-xs uppercase tracking-widest block mb-3">Your Role</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border text-center transition-all ${
                    role === r.value
                      ? 'border-[#00e5a0] bg-[#f0fff8] text-[#0d0d0f]'
                      : 'border-[#e2e4e8] bg-white text-[#6b6b7a] hover:border-[#00e5a0]/50 hover:text-[#0d0d0f]'
                  }`}
                >
                  <span className="text-xl leading-none">{r.icon}</span>
                  <span className="text-xs font-medium leading-tight">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-[#ff5c3a] text-sm mb-4">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#00e5a0] text-black font-bold rounded-xl py-4 text-sm tracking-widest hover:bg-[#00ffc0] transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'CONTINUE TO DASHBOARD'}
          </button>
        </div>
      </div>

    </main>
  )
}
