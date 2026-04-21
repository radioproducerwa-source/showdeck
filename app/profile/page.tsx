'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

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

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/'); return }
      setUser(data.user)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      if (profile) {
        setDisplayName(profile.display_name || '')
        setRole(profile.role || '')
        setAvatarUrl(profile.avatar_url || null)
      }
    })
  }, [])

  const uploadAvatar = async (file: File) => {
    if (!user) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `profile-${user.id}.${ext}`
    const { error } = await supabase.storage.from('show-logos').upload(path, file, { upsert: true })
    if (error) { alert('Upload failed: ' + error.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('show-logos').getPublicUrl(path)
    setAvatarUrl(publicUrl)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    setUploading(false)
  }

  const handleSave = async () => {
    if (!displayName.trim() || !role) return
    setSaving(true)
    await supabase.from('profiles').update({ display_name: displayName.trim(), role }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!user) return <div className="min-h-screen bg-white" />

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#0d0d0f]">
      <header className="bg-white border-b border-[#e2e4e8] px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-[#6b6b7a] hover:text-[#0d0d0f] text-sm transition-colors">← Dashboard</a>
          <Logo size={0.65} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-1">Your Profile</h1>
        <p className="text-[#6b6b7a] text-sm mb-8">How your teammates see you</p>

        <div className="bg-white border border-[#e2e4e8] rounded-2xl p-8 flex flex-col gap-6">

          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div
              className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0 border-2 border-[#e2e4e8] bg-[#f7f8fa] flex items-center justify-center cursor-pointer hover:border-[#00e5a0] transition-colors group"
              onClick={() => fileInput.current?.click()}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                : <span className="text-3xl">{displayName?.[0]?.toUpperCase() || '?'}</span>}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                <span className="text-white text-xs font-bold">{uploading ? '…' : '↑'}</span>
              </div>
              <input ref={fileInput} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }} />
            </div>
            <div>
              <p className="text-sm font-semibold mb-0.5">Profile photo</p>
              <p className="text-xs text-[#6b6b7a]">Click to {avatarUrl ? 'replace' : 'upload'}</p>
            </div>
          </div>

          {/* Display name */}
          <div>
            <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">Your Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
            />
          </div>

          {/* Role */}
          <div>
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

          <button
            onClick={handleSave}
            disabled={saving || !displayName.trim() || !role}
            className="w-full bg-[#00e5a0] text-black font-bold rounded-xl py-3 text-sm tracking-widest hover:bg-[#00ffc0] transition-colors disabled:opacity-50"
          >
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>
    </main>
  )
}
