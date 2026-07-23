'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>('checking')
  const router = useRouter()

  useEffect(() => {
    // Supabase puts the session in the URL hash after clicking the reset link,
    // but exchanging it is async — a single getSession() on mount races it.
    // Listen for the auth event, with getSession() as a fast path and a
    // timeout that gives up if nothing arrives.
    let done = false
    const markReady = () => {
      if (done) return
      done = true
      setStatus('ready')
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) markReady()
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady()
    })

    const timeout = setTimeout(() => {
      if (!done) {
        done = true
        setStatus('invalid')
        setMessage('This reset link is invalid or has expired. Please request a new one.')
      }
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleReset = async () => {
    if (password.length < 6) { setMessage('Password must be at least 6 characters.'); setIsError(true); return }
    if (password !== confirm) { setMessage('Passwords don\'t match.'); setIsError(true); return }
    setLoading(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) { setMessage(error.message); setIsError(true) }
      else {
        setMessage('Password updated! Redirecting…')
        setIsError(false)
        setTimeout(() => router.push('/dashboard'), 1500)
      }
    } catch (e: any) {
      setMessage(e?.message || 'Something went wrong. Please try again.')
      setIsError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-[#f7f8fa]">
      <div className="bg-white border border-[#e2e4e8] rounded-2xl p-10 w-full max-w-md shadow-sm">
        <div className="mb-6"><Logo size={1.1} /></div>
        <h2 className="text-xl font-bold mb-1">Set a new password</h2>
        <p className="text-[#6b6b7a] text-sm mb-8">Choose a new password for your Showdeck account.</p>

        {status === 'ready' ? (
          <>
            <div className="mb-4">
              <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">New password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
                placeholder="••••••••"
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleReset()}
              />
            </div>
            {message && (
              <div className={`mb-5 rounded-xl px-4 py-3 text-sm ${isError ? 'bg-[#fef2f2] border border-red-200 text-red-700' : 'bg-[#edfdf6] border border-[#00e5a0]/40 text-[#0a6b47]'}`}>
                {message}
              </div>
            )}
            <button
              onClick={handleReset}
              disabled={loading}
              className="w-full bg-[#00e5a0] text-black font-bold rounded-xl py-4 text-lg tracking-widest hover:bg-[#00ffc0] transition-colors disabled:opacity-60"
            >
              {loading ? 'Updating…' : 'UPDATE PASSWORD'}
            </button>
          </>
        ) : status === 'invalid' ? (
          <div className="rounded-xl px-4 py-3 text-sm bg-[#fef2f2] border border-red-200 text-red-700">
            {message || 'This reset link is invalid or has expired. Please request a new one.'}
          </div>
        ) : (
          <div className="rounded-xl px-4 py-3 text-sm text-[#6b6b7a]">
            Verifying reset link…
          </div>
        )}

        <Link href="/" className="block text-center text-sm text-[#6b6b7a] hover:text-[#0d0d0f] mt-6 transition-colors">
          ← Back to sign in
        </Link>
      </div>
    </main>
  )
}
