'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [shows, setShows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
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

  const getInitials = (name: string) =>
    (name || '').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '??'

  const getHostLine = (show: any) => {
    const parts = [show.host1_name, show.host2_name].filter(Boolean)
    if (show.has_producer && show.producer_name) parts.push(show.producer_name)
    return parts.join(' · ')
  }

  if (!user) return <div className="min-h-screen bg-[#f7f8fa]" />

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#0d0d0f]">
      {/* Nav */}
      <header className="bg-white border-b border-[#e2e4e8] px-8 h-14 flex items-center justify-between">
        <Logo size={0.75} />
        <div className="flex items-center gap-4">
          <a href="/profile" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[#00e5a0] flex items-center justify-center">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
                : <span className="text-black text-sm font-bold">{profile?.display_name?.[0]?.toUpperCase()}</span>}
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-[#0d0d0f] leading-tight">{profile?.display_name}</div>
              <div className="text-[10px] text-[#6b6b7a] capitalize leading-tight">{profile?.role}</div>
            </div>
          </a>
          <div className="w-px h-5 bg-[#e2e4e8]" />
          <button onClick={signOut} className="text-[#6b6b7a] border border-[#e2e4e8] rounded-lg px-4 py-1.5 text-sm hover:text-[#0d0d0f] transition-colors">Sign out</button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-[#6b6b7a]">Loading...</div>
      ) : shows.length === 0 ? (
        <div className="max-w-sm mx-auto mt-24 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-white border border-[#e2e4e8] flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">🎙️</span>
          </div>
          <h2 className="text-xl font-bold mb-2">No shows yet</h2>
          <p className="text-[#6b6b7a] mb-6 text-sm">Create your first show to get started</p>
          <a href="/create-show" className="bg-[#00e5a0] text-black font-bold rounded-xl px-8 py-3 hover:bg-[#00ffc0] transition-colors inline-block">Create Show</a>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-xs font-semibold text-[#6b6b7a] uppercase tracking-widest">Your Shows</h1>
            <a href="/create-show" className="bg-[#00e5a0] text-black font-bold rounded-xl px-5 py-2.5 text-sm hover:bg-[#00ffc0] transition-colors">+ New Show</a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shows.map(show => (
              <a
                key={show.id}
                href={`/shows/${show.id}`}
                className="group block rounded-2xl overflow-hidden border border-[#e2e4e8] bg-white hover:border-[#00e5a0] hover:shadow-[0_4px_20px_rgba(0,229,160,0.12)] transition-all duration-200"
              >
                {/* Artwork */}
                <div className="aspect-square relative bg-[#f7f8fa]">
                  {show.logo_url ? (
                    <img src={show.logo_url} alt={show.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #edfdf6 0%, #d6f5ea 100%)' }}>
                      <span className="text-[4.5rem] font-black leading-none tracking-tighter select-none text-[#00a870]">
                        {getInitials(show.name)}
                      </span>
                    </div>
                  )}
                  {/* Type badge */}
                  <div className="absolute top-3 right-3">
                    <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-sm text-white">
                      {show.show_type === 'radio' ? '📻 Radio' : '🎙️ Podcast'}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="px-5 py-4 border-t border-[#e2e4e8]">
                  <h2 className="font-bold text-[#0d0d0f] leading-snug group-hover:text-[#00a870] transition-colors duration-200 mb-1 truncate">
                    {show.name}
                  </h2>
                  {getHostLine(show) && (
                    <p className="text-xs text-[#6b6b7a] truncate">{getHostLine(show)}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
