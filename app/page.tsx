'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleAuth = async () => {
    setLoading(true)
    setMessage('')
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage('Check your email to confirm your account!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
      else window.location.href = '/dashboard'
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#0d0d0f] flex items-center justify-center p-4">
      <div className="bg-[#141417] border border-[#2a2a32] rounded-2xl p-10 w-full max-w-md">
        <h1 className="text-5xl font-bold text-[#00e5a0] tracking-widest mb-1">SHOWDECK</h1>
        <p className="text-[#6b6b7a] text-sm mb-8">The collaborative show planning workspace</p>
        <div className="mb-4">
          <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-[#1c1c21] border border-[#2a2a32] rounded-lg text-white px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
            placeholder="you@example.com"
          />
        </div>
        <div className="mb-6">
          <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-[#1c1c21] border border-[#2a2a32] rounded-lg text-white px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
            placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
          />
        </div>
        {message && (
          <p className="text-sm mb-4 text-[#00e5a0]">{message}</p>
        )}
        <button
          onClick={handleAuth}
          disabled={loading}
          className="w-full bg-[#00e5a0] text-black font-bold rounded-xl py-4 text-lg tracking-widest mb-3 hover:bg-[#00ffc0] transition-colors"
        >
          {loading ? 'Loading...' : isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
        </button>
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full bg-transparent text-[#6b6b7a] border border-[#2a2a32] rounded-xl py-3 text-sm hover:text-white transition-colors"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </main>
  )
}
