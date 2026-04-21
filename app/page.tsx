'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import Logo, { LogoIcon } from '../components/Logo'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleAuth = async () => {
    setLoading(true)
    setMessage('')
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage('Check your email to confirm your account!')
    } else {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
      else {
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', data.user.id).single()
        window.location.href = profile ? '/dashboard' : '/profile/setup'
      }
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex">

      {/* Left: branding panel */}
      <div className="hidden lg:flex flex-col w-[460px] flex-shrink-0 bg-[#0d0d0f] p-12 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-auto">
          <LogoIcon size={28} />
          <span className="text-white font-bold text-xl tracking-[0.2em]" style={{ fontFamily: 'monospace' }}>SHOWDECK</span>
        </div>
        <div className="mt-auto">
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">Plan every episode.<br />Together.</h2>
          <p className="text-white/50 text-sm leading-relaxed mb-10">The collaborative show planning workspace for podcast teams.</p>
          <div className="flex flex-col gap-4">
            {[
              { icon: '🎙️', text: 'Plan every segment, together' },
              { icon: '📋', text: 'Runsheets that write themselves' },
              { icon: '🔗', text: 'Everything in one place, show to show' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#00e5a0]/10 flex items-center justify-center flex-shrink-0 text-base">{icon}</div>
                <span className="text-white/60 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Decorative oversized logo watermark */}
        <div className="absolute -bottom-16 -right-16 opacity-[0.04] pointer-events-none">
          <LogoIcon size={320} />
        </div>
      </div>

      {/* Right: form panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#f7f8fa]">
        <div className="bg-white border border-[#e2e4e8] rounded-2xl p-10 w-full max-w-md shadow-sm">
          <div className="mb-1 lg:hidden"><Logo size={1.1} /></div>
          <h2 className="text-xl font-bold mb-1">{isSignUp ? 'Create your account' : 'Welcome back'}</h2>
          <p className="text-[#6b6b7a] text-sm mb-8">{isSignUp ? 'Set up your Showdeck account' : 'Sign in to your workspace'}</p>

          <div className="mb-4">
            <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <div className="mb-6">
            <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
              autoComplete="current-password"
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
            />
          </div>
          {message && <p className="text-sm mb-4 text-[#00a870]">{message}</p>}
          <button
            onClick={handleAuth}
            disabled={loading}
            className="w-full bg-[#00e5a0] text-black font-bold rounded-xl py-4 text-lg tracking-widest mb-3 hover:bg-[#00ffc0] transition-colors disabled:opacity-60"
          >
            {loading ? 'Loading...' : isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
          </button>
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full bg-transparent text-[#6b6b7a] border border-[#e2e4e8] rounded-xl py-3 text-sm hover:text-[#0d0d0f] transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>

    </main>
  )
}
