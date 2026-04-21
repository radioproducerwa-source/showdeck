'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { LogoIcon } from '../../components/Logo'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [shows, setShows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterText, setFilterText] = useState('')
  const [uploading, setUploading] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/'); return }
      setUser(data.user)
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      if (!profileData) { router.push('/profile/setup'); return }
      setProfile(profileData)
      const { data: showsData } = await supabase.from('shows').select('*').eq('owner_id', data.user.id)
      setShows(showsData || [])
      setLoading(false)
    })
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const uploadLogo = async (showId: string, file: File) => {
    setUploading(showId)
    const ext = file.name.split('.').pop()
    const path = `${showId}.${ext}`
    const { error: uploadError } = await supabase.storage.from('show-logos').upload(path, file, { upsert: true })
    if (uploadError) { alert('Upload failed: ' + uploadError.message); setUploading(null); return }
    const { data: { publicUrl } } = supabase.storage.from('show-logos').getPublicUrl(path)
    await supabase.from('shows').update({ logo_url: publicUrl }).eq('id', showId)
    setShows(prev => prev.map(s => s.id === showId ? { ...s, logo_url: publicUrl } : s))
    setUploading(null)
  }

  const filteredShows = shows.filter(s =>
    s.name.toLowerCase().includes(filterText.toLowerCase())
  )
  const radioShows = filteredShows.filter(s => s.show_type === 'radio')
  const podcastShows = filteredShows.filter(s => s.show_type !== 'radio')

  if (!user) return <div className="min-h-screen bg-[#0d0d0f]" />

  return (
    <div className="min-h-screen flex flex-col bg-[#0d0d0f]">

      {/* Top nav */}
      <header className="h-14 flex items-center justify-between px-8 flex-shrink-0 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <LogoIcon size={22} />
          <span className="text-white font-bold text-base tracking-[0.18em]" style={{ fontFamily: 'monospace' }}>SHOWDECK</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/create-show"
            className="bg-[#00e5a0] text-black font-bold rounded-lg px-4 py-1.5 text-xs tracking-widest hover:bg-[#00ffc0] transition-colors">
            + NEW SHOW
          </a>
          <a href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-full overflow-hidden bg-[#00e5a0] flex items-center justify-center flex-shrink-0">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : <span className="text-black text-xs font-bold">{profile?.display_name?.[0]?.toUpperCase()}</span>}
            </div>
            <span className="text-white/60 text-sm hidden sm:block">{profile?.display_name}</span>
          </a>
          <button onClick={signOut} className="text-white/30 text-xs hover:text-white/70 transition-colors">Sign out</button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-32 text-white/30 text-sm">Loading...</div>
        ) : shows.length === 0 ? (
          <div className="max-w-sm mx-auto mt-32 text-center">
            <div className="text-5xl mb-4">🎙️</div>
            <h2 className="text-xl font-bold mb-2 text-white">No shows yet</h2>
            <p className="text-white/40 text-sm mb-6">Create your first show to get started</p>
            <a href="/create-show" className="inline-block bg-[#00e5a0] text-black font-bold rounded-xl px-8 py-3 text-sm hover:bg-[#00ffc0] transition-colors">Create Show</a>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto px-8 py-10">

            {/* Header row */}
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-white text-2xl font-bold">Your shows</h1>
              <input
                type="text"
                placeholder="Search shows…"
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                className="w-56 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#00e5a0]/50 placeholder-white/25"
              />
            </div>

            {filteredShows.length === 0 ? (
              <p className="text-white/40 text-sm">No shows match your search.</p>
            ) : (
              <>
                {radioShows.length > 0 && (
                  <ShowGroup label="Radio" icon="📻" shows={radioShows} uploading={uploading} fileInputs={fileInputs} onUpload={uploadLogo} />
                )}
                {podcastShows.length > 0 && (
                  <ShowGroup label="Podcasts" icon="🎙️" shows={podcastShows} uploading={uploading} fileInputs={fileInputs} onUpload={uploadLogo} />
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function ShowGroup({ label, icon, shows, uploading, fileInputs, onUpload }: {
  label: string
  icon: string
  shows: any[]
  uploading: string | null
  fileInputs: React.RefObject<Record<string, HTMLInputElement | null>>
  onUpload: (showId: string, file: File) => void
}) {
  return (
    <div className="mb-12">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-base">{icon}</span>
        <h2 className="text-sm font-semibold text-white/40 uppercase tracking-widest">{label}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
        {shows.map(show => (
          <ShowCard key={show.id} show={show} uploading={uploading} fileInputs={fileInputs} onUpload={onUpload} />
        ))}
      </div>
    </div>
  )
}

function ShowCard({ show, uploading, fileInputs, onUpload }: {
  show: any
  uploading: string | null
  fileInputs: React.RefObject<Record<string, HTMLInputElement | null>>
  onUpload: (showId: string, file: File) => void
}) {
  return (
    <div className="group flex flex-col">
      <a href={`/planner/${show.id}`} className="block relative aspect-square rounded-2xl overflow-hidden bg-white/[0.06] border border-white/[0.08] hover:border-white/20 hover:scale-[1.02] transition-all duration-200">
        {show.logo_url ? (
          <img src={show.logo_url} alt={show.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl opacity-60">{show.show_type === 'radio' ? '📻' : '🎙️'}</span>
          </div>
        )}
        {/* Upload overlay */}
        <div
          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2 cursor-pointer"
          onClick={e => { e.preventDefault(); fileInputs.current[show.id]?.click() }}
        >
          <span className="text-white text-[10px] font-bold bg-black/60 rounded px-1.5 py-0.5">
            {uploading === show.id ? '…' : 'Change art'}
          </span>
        </div>
        <input
          ref={el => { fileInputs.current[show.id] = el }}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(show.id, f) }}
        />
      </a>
      <div className="mt-3 px-0.5">
        <a href={`/planner/${show.id}`} className="text-sm font-semibold text-white/90 hover:text-white transition-colors line-clamp-2 leading-snug block">
          {show.name}
        </a>
        <div className="flex items-center gap-2 mt-1.5">
          <a href={`/planner/${show.id}?new=true`} className="text-[10px] text-[#00e5a0]/70 font-medium hover:text-[#00e5a0] transition-colors">+ Episode</a>
          <span className="text-white/10">·</span>
          <a href={`/show-settings/${show.id}`} className="text-[10px] text-white/30 hover:text-white/60 transition-colors">Settings</a>
        </div>
      </div>
    </div>
  )
}
