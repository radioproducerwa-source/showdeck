'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Logo, { LogoIcon } from '../../components/Logo'

export default function CreateShow() {
  const [user, setUser] = useState<any>(null)
  const [showName, setShowName] = useState('')
  const [host1, setHost1] = useState('')
  const [host2, setHost2] = useState('')
  const [hasProducer, setHasProducer] = useState(false)
  const [producer, setProducer] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/')
      else setUser(data.user)
    })
  }, [])

  const handleCreate = async () => {
    if (!showName || !host1 || !host2) {
      setMessage('Please fill in show name and both host names')
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('shows')
      .insert({
        name: showName,
        owner_id: user.id,
        host1_name: host1,
        host2_name: host2,
        has_producer: hasProducer,
        producer_name: hasProducer ? producer : null
      })
      .select()
      .single()

    if (error) {
      setMessage(error.message)
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  if (!user) return <div className="min-h-screen bg-[#f7f8fa]"></div>

  return (
    <main className="min-h-screen flex">

      {/* Left: branding panel */}
      <div className="hidden lg:flex flex-col w-[460px] flex-shrink-0 bg-[#0d0d0f] p-12 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-auto">
          <LogoIcon size={28} />
          <span className="text-white font-bold text-xl tracking-[0.2em]" style={{ fontFamily: 'monospace' }}>SHOWDECK</span>
        </div>
        <div className="mt-auto">
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">Your show.<br />Your way.</h2>
          <p className="text-white/50 text-sm leading-relaxed mb-10">Give your podcast a home in Showdeck. You can add avatars and social handles from settings any time.</p>
          <div className="flex flex-col gap-4">
            {[
              { icon: '🎙️', text: 'Add your show name and hosts' },
              { icon: '📅', text: 'Create episodes and plan segments' },
              { icon: '✅', text: 'Export your runsheet before you go live' },
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

      {/* Right: form panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#f7f8fa]">
        <div className="bg-white border border-[#e2e4e8] rounded-2xl p-10 w-full max-w-lg shadow-sm">
          <div className="mb-1 lg:hidden"><Logo size={0.9} /></div>
          <h2 className="text-xl font-bold mb-1">Create a new show</h2>
          <p className="text-[#6b6b7a] text-sm mb-8">Set up your show to get started</p>

          <div className="mb-5">
            <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">Show Name</label>
            <input type="text" value={showName} onChange={e => setShowName(e.target.value)}
              className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
              placeholder="e.g. The Footy Punt" />
          </div>
          <div className="mb-5">
            <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">Host 1 Name</label>
            <input type="text" value={host1} onChange={e => setHost1(e.target.value)}
              className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
              placeholder="Your name" />
          </div>
          <div className="mb-5">
            <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">Host 2 Name</label>
            <input type="text" value={host2} onChange={e => setHost2(e.target.value)}
              className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
              placeholder="Co-host name" />
          </div>
          <div className="mb-6">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setHasProducer(!hasProducer)}>
              <div className={`w-9 h-5 rounded-full relative transition-colors ${hasProducer ? 'bg-[#a78bfa]' : 'bg-[#e2e4e8]'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${hasProducer ? 'translate-x-4' : 'translate-x-0.5'}`}></div>
              </div>
              <span className="text-[#6b6b7a] text-sm">Include a Producer role</span>
            </div>
            {hasProducer && (
              <input type="text" value={producer} onChange={e => setProducer(e.target.value)}
                className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-3 text-sm outline-none focus:border-[#a78bfa]"
                placeholder="Producer name" />
            )}
          </div>
          {message && <p className="text-[#ff5c3a] text-sm mb-4">{message}</p>}
          <button onClick={handleCreate} disabled={loading}
            className="w-full bg-[#00e5a0] text-black font-bold rounded-xl py-4 text-lg tracking-widest hover:bg-[#00ffc0] transition-colors disabled:opacity-60">
            {loading ? 'Creating...' : 'CREATE SHOW'}
          </button>
        </div>
      </div>

    </main>
  )
}
