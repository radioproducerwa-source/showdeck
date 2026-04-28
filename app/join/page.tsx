'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Logo, { LogoIcon } from '../../components/Logo'

type Status =
  | 'loading'
  | 'invalid'
  | 'already_accepted'
  | 'auth_required'
  | 'accepting'
  | 'done'

function JoinContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const router = useRouter()

  const [status, setStatus] = useState<Status>('loading')
  const [invite, setInvite] = useState<any>(null)
  const [showName, setShowName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }
    init()
  }, [token])

  const init = async () => {
    // Try to fetch the invite — may fail if RLS blocks anon access
    try {
      const { data: inv } = await supabase
        .from('show_invites')
        .select('id, show_id, email, role, accepted, token, shows(name)')
        .eq('token', token as string)
        .single()

      if (inv) {
        if (inv.accepted) { setStatus('already_accepted'); return }
        setInvite(inv)
        setShowName((inv.shows as any)?.name || '')
        setEmail(inv.email || '')
      }
    } catch {
      // RLS may block pre-auth lookup — handled after sign-in
    }

    // Check if already logged in
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Re-fetch with auth context if pre-auth lookup failed
      let inv = invite
      if (!inv) {
        const { data } = await supabase
          .from('show_invites')
          .select('id, show_id, email, role, accepted, token, shows(name)')
          .eq('token', token as string)
          .single()
        if (!data) { setStatus('invalid'); return }
        if (data.accepted) { setStatus('already_accepted'); return }
        inv = data
        setInvite(inv)
        setShowName((data.shows as any)?.name || '')
      }
      await acceptInvite(inv, user.id)
    } else {
      if (!invite && !showName) {
        // Could not load invite pre-auth — show generic form
        // Will validate token properly after sign-in
      }
      setStatus('auth_required')
    }
  }

  const acceptInvite = async (inv: any, userId: string) => {
    setStatus('accepting')

    // Check if already a member
    const { data: existing } = await supabase
      .from('show_members')
      .select('id')
      .eq('show_id', inv.show_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (!existing) {
      await supabase.from('show_members').insert({
        show_id: inv.show_id,
        user_id: userId,
        role: inv.role,
      })
    }

    await supabase
      .from('show_invites')
      .update({ accepted: true })
      .eq('id', inv.id)

    setStatus('done')

    // Check if profile exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    setTimeout(() => {
      router.push(profile ? '/dashboard' : '/profile/setup')
    }, 1800)
  }

  const handleAuth = async () => {
    setAuthLoading(true)
    setAuthMessage('')

    let userId: string | null = null

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setAuthMessage(error.message); setAuthLoading(false); return }
      if (data.session) {
        userId = data.session.user.id
      } else {
        setAuthMessage('Check your email to confirm your account, then return to this invite link.')
        setAuthLoading(false)
        return
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setAuthMessage(error.message); setAuthLoading(false); return }
      userId = data.user.id
    }

    // Re-fetch invite with auth context if we didn't have it before
    let inv = invite
    if (!inv) {
      const { data } = await supabase
        .from('show_invites')
        .select('id, show_id, email, role, accepted, token, shows(name)')
        .eq('token', token as string)
        .single()
      if (!data) { setAuthMessage('Invite not found or invalid.'); setAuthLoading(false); return }
      if (data.accepted) { setStatus('already_accepted'); setAuthLoading(false); return }
      inv = data
      setInvite(inv)
      setShowName((data.shows as any)?.name || '')
    }

    setAuthLoading(false)
    await acceptInvite(inv, userId)
  }

  const roleLabel = (r: string) =>
    r === 'host1' ? 'Host 1' : r === 'host2' ? 'Host 2' : 'Producer'

  // ── Status screens ──────────────────────────────────────────────

  if (status === 'loading') return (
    <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center text-[#6b6b7a]">Loading…</div>
  )

  if (status === 'invalid') return (
    <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">🔗</div>
        <h2 className="text-xl font-bold mb-2">Invalid invite link</h2>
        <p className="text-[#6b6b7a] text-sm mb-6">This invite link is invalid or could not be found.</p>
        <a href="/" className="bg-[#00e5a0] text-black font-bold rounded-xl px-6 py-3 hover:bg-[#00ffc0] transition-colors inline-block">Go to Showdeck</a>
      </div>
    </div>
  )

  if (status === 'already_accepted') return (
    <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">✅</div>
        <h2 className="text-xl font-bold mb-2">Already accepted</h2>
        <p className="text-[#6b6b7a] text-sm mb-6">This invite has already been used. Sign in to access your shows.</p>
        <a href="/" className="bg-[#00e5a0] text-black font-bold rounded-xl px-6 py-3 hover:bg-[#00ffc0] transition-colors inline-block">Sign In</a>
      </div>
    </div>
  )

  if (status === 'accepting' || status === 'done') return (
    <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-5">{status === 'done' ? '🎉' : '⏳'}</div>
        <h2 className="text-2xl font-bold mb-2">{status === 'done' ? "You're in!" : 'Joining…'}</h2>
        <p className="text-[#6b6b7a] text-sm">
          {status === 'done'
            ? `Welcome to ${showName || 'the show'}. Taking you to your dashboard…`
            : 'Setting up your access…'}
        </p>
      </div>
    </div>
  )

  // ── Auth required ────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex">
      {/* Left branding */}
      <div className="hidden lg:flex flex-col w-[460px] flex-shrink-0 bg-[#0d0d0f] p-12 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-auto">
          <LogoIcon size={28} />
          <span className="text-white font-bold text-xl tracking-[0.2em]" style={{ fontFamily: 'monospace' }}>SHOWDECK</span>
        </div>
        <div className="mt-auto">
          <p className="text-[#00e5a0] text-xs font-bold uppercase tracking-widest mb-3">You've been invited</p>
          {showName
            ? <h2 className="text-white text-3xl font-bold leading-tight mb-3">{showName}</h2>
            : <h2 className="text-white text-3xl font-bold leading-tight mb-3">Join the show</h2>
          }
          {invite?.role && (
            <p className="text-white/50 text-sm">Joining as {roleLabel(invite.role)}</p>
          )}
        </div>
        <div className="absolute -bottom-16 -right-16 opacity-[0.04] pointer-events-none">
          <LogoIcon size={320} />
        </div>
      </div>

      {/* Right: auth form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#f7f8fa]">
        <div className="bg-white border border-[#e2e4e8] rounded-2xl p-10 w-full max-w-md shadow-sm">
          <div className="mb-6 lg:hidden"><Logo size={1.1} /></div>

          {/* Invite context banner */}
          {(showName || invite?.role) && (
            <div className="mb-6 bg-[#edfdf6] border border-[#00e5a0]/40 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#00a870] mb-1">You've been invited to</p>
              {showName && <p className="font-bold text-[#0d0d0f] text-sm">{showName}</p>}
              {invite?.role && <p className="text-xs text-[#6b6b7a] mt-0.5">Role: {roleLabel(invite.role)}</p>}
            </div>
          )}

          <h2 className="text-xl font-bold mb-1">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-[#6b6b7a] text-sm mb-6">
            {isSignUp ? 'Sign up to accept your invite' : 'Sign in to accept your invite'}
          </p>

          <div className="mb-4">
            <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
            />
          </div>
          <div className="mb-6">
            <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
              className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
            />
          </div>

          {authMessage && (
            <p className="text-sm mb-4 text-[#6b6b7a] bg-[#f7f8fa] border border-[#e2e4e8] rounded-xl px-4 py-3">
              {authMessage}
            </p>
          )}

          <button
            onClick={handleAuth}
            disabled={authLoading || !email || !password}
            className="w-full bg-[#00e5a0] text-black font-bold rounded-xl py-4 text-sm tracking-widest mb-3 hover:bg-[#00ffc0] transition-colors disabled:opacity-60"
          >
            {authLoading ? 'Loading…' : isSignUp ? 'CREATE ACCOUNT & JOIN' : 'SIGN IN & JOIN'}
          </button>
          <button
            onClick={() => { setIsSignUp(s => !s); setAuthMessage('') }}
            className="w-full bg-transparent text-[#6b6b7a] border border-[#e2e4e8] rounded-xl py-3 text-sm hover:text-[#0d0d0f] transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </main>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center text-[#6b6b7a]">Loading…</div>
    }>
      <JoinContent />
    </Suspense>
  )
}
