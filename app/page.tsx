'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import Logo, { LogoIcon } from '../components/Logo'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleGoogle = async () => {
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard' },
    })
    setGoogleLoading(false)
  }

  const handleAuth = async () => {
    setLoading(true)
    setMessage('')
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage('Check your email to confirm your account!')
    } else {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setMessage(error.message) }
      else {
        if (!rememberMe) {
          // Clear persisted session so it doesn't survive a browser restart
          Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k))
        }
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

          {/* Google sign-in */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-[#e2e4e8] rounded-xl py-3 text-sm font-semibold text-[#0d0d0f] hover:border-[#c8cad0] hover:bg-[#f7f8fa] transition-colors disabled:opacity-60 mb-6"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-[#e2e4e8]" />
            <span className="text-xs text-[#9a9aaa] uppercase tracking-widest">or continue with email</span>
            <div className="flex-1 h-px bg-[#e2e4e8]" />
          </div>

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
          {!isSignUp && (
            <label className="flex items-center gap-2.5 mb-5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-[#e2e4e8] accent-[#00e5a0] cursor-pointer"
              />
              <span className="text-sm text-[#6b6b7a]">Remember me</span>
            </label>
          )}
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
