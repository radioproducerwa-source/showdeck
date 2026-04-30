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

function BrandPanel({ showName, role }: { showName?: string; role?: string }) {
  const roleLabel = (r: string) =>
    r === 'host1' ? 'Host 1' : r === 'host2' ? 'Host 2' : 'Producer'

  return (
    <div className="hidden lg:flex flex-col w-[460px] flex-shrink-0 bg-[#0d0d0f] relative overflow-hidden">
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 flex flex-col h-full p-12">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <LogoIcon size={28} />
          <span
            className="text-white font-bold text-xl tracking-[0.2em]"
            style={{ fontFamily: 'monospace' }}
          >
            SHOWDECK
          </span>
        </div>

        {/* Centre message */}
        <div className="my-auto">
          <p className="text-[#00e5a0] text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
            You've been invited
          </p>
          <h2 className="text-white text-4xl font-bold leading-tight mb-3">
            {showName || 'Join the show'}
          </h2>
          {role && (
            <span className="inline-block bg-white/10 text-white/70 text-xs font-semibold rounded-full px-3 py-1 tracking-wide">
              Joining as {roleLabel(role)}
            </span>
          )}
        </div>

        {/* Tagline */}
        <p className="text-white/20 text-xs tracking-widest font-medium">
          Podcast planning, made together.
        </p>
      </div>

      {/* Watermark icon */}
      <div className="absolute -bottom-20 -right-20 opacity-[0.035] pointer-events-none">
        <LogoIcon size={360} />
      </div>
    </div>
  )
}

function StatusCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#f7f8fa]">
      <div className="bg-white border border-[#e2e4e8] rounded-2xl p-10 w-full max-w-sm shadow-sm text-center">
        {children}
      </div>
    </div>
  )
}

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

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
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
      setStatus('auth_required')
    }
  }

  const acceptInvite = async (inv: any, userId: string) => {
    setStatus('accepting')

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
      .update({ accepted: true, user_id: userId })
      .eq('id', inv.id)

    setStatus('done')

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    setTimeout(() => {
      router.push(profile ? '/dashboard' : '/profile/setup')
    }, 2200)
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

  // ── Loading ──────────────────────────────────────────────────────

  if (status === 'loading') return (
    <main className="min-h-screen flex">
      <BrandPanel showName={showName} role={invite?.role} />
      <StatusCard>
        <div className="flex justify-center mb-6">
          <Logo size={0.9} />
        </div>
        <div className="flex items-center justify-center gap-2 text-[#6b6b7a] text-sm">
          <svg className="animate-spin w-4 h-4 text-[#00e5a0]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Verifying invite…
        </div>
      </StatusCard>
    </main>
  )

  // ── Invalid ──────────────────────────────────────────────────────

  if (status === 'invalid') return (
    <main className="min-h-screen flex">
      <BrandPanel />
      <StatusCard>
        <div className="flex justify-center mb-6">
          <Logo size={0.9} />
        </div>
        <div className="w-12 h-12 rounded-full bg-[#fef2f2] border border-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-[#0d0d0f] mb-2">Invalid invite link</h2>
        <p className="text-[#6b6b7a] text-sm mb-6">
          This invite link is invalid or has expired. Ask your show admin to send a new one.
        </p>
        <a
          href="/"
          className="inline-block bg-[#0d0d0f] text-white font-bold rounded-xl px-6 py-3 text-sm hover:bg-[#2a2a2e] transition-colors"
        >
          Go to Showdeck
        </a>
      </StatusCard>
    </main>
  )

  // ── Already accepted ─────────────────────────────────────────────

  if (status === 'already_accepted') return (
    <main className="min-h-screen flex">
      <BrandPanel showName={showName} role={invite?.role} />
      <StatusCard>
        <div className="flex justify-center mb-6">
          <Logo size={0.9} />
        </div>
        <div className="w-12 h-12 rounded-full bg-[#edfdf6] border border-[#00e5a0]/30 flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-[#00a870]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-[#0d0d0f] mb-2">Already accepted</h2>
        <p className="text-[#6b6b7a] text-sm mb-6">
          This invite has already been used. Sign in to access your shows.
        </p>
        <a
          href="/"
          className="inline-block bg-[#00e5a0] text-black font-bold rounded-xl px-6 py-3 text-sm hover:bg-[#00ffc0] transition-colors"
        >
          Sign In
        </a>
      </StatusCard>
    </main>
  )

  // ── Accepting / Done ─────────────────────────────────────────────

  if (status === 'accepting' || status === 'done') return (
    <main className="min-h-screen flex">
      <BrandPanel showName={showName} role={invite?.role} />
      <StatusCard>
        <div className="flex justify-center mb-6">
          <Logo size={0.9} />
        </div>
        {status === 'done' ? (
          <>
            <div className="w-14 h-14 rounded-full bg-[#edfdf6] border border-[#00e5a0]/30 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-[#00a870]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#0d0d0f] mb-2">You're in!</h2>
            <p className="text-[#6b6b7a] text-sm">
              Welcome to{' '}
              <span className="font-semibold text-[#0d0d0f]">{showName || 'the show'}</span>.
              Taking you to your dashboard…
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 text-[#6b6b7a] text-sm mb-2">
              <svg className="animate-spin w-4 h-4 text-[#00e5a0]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Setting up your access…
            </div>
          </>
        )}
      </StatusCard>
    </main>
  )

  // ── Auth required ────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex">
      <BrandPanel showName={showName} role={invite?.role} />

      <div className="flex-1 flex items-center justify-center p-8 bg-[#f7f8fa]">
        <div className="bg-white border border-[#e2e4e8] rounded-2xl p-10 w-full max-w-md shadow-sm">

          {/* Mobile logo */}
          <div className="mb-7 lg:hidden flex justify-center">
            <Logo size={0.9} />
          </div>

          {/* Invite context banner */}
          {(showName || invite?.role) && (
            <div className="mb-6 bg-[#edfdf6] border border-[#00e5a0]/40 rounded-xl px-4 py-3.5 flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-[#00e5a0]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-[#00a870]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#00a870] mb-0.5">
                  You've been invited to
                </p>
                {showName && <p className="font-bold text-[#0d0d0f] text-sm leading-snug">{showName}</p>}
                {invite?.role && (
                  <p className="text-xs text-[#6b6b7a] mt-0.5">
                    Role: {invite.role === 'host1' ? 'Host 1' : invite.role === 'host2' ? 'Host 2' : 'Producer'}
                  </p>
                )}
              </div>
            </div>
          )}

          <h2 className="text-xl font-bold text-[#0d0d0f] mb-1">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-[#6b6b7a] text-sm mb-6">
            {isSignUp ? 'Sign up to accept your invite' : 'Sign in to accept your invite'}
          </p>

          <div className="mb-4">
            <label className="block text-[#6b6b7a] text-[10px] uppercase tracking-widest font-semibold mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full bg-[#f7f8fa] border border-[#e2e4e8] rounded-xl text-[#0d0d0f] px-4 py-3 text-sm outline-none focus:border-[#00e5a0] focus:bg-white transition-colors"
            />
          </div>
          <div className="mb-6">
            <label className="block text-[#6b6b7a] text-[10px] uppercase tracking-widest font-semibold mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
              className="w-full bg-[#f7f8fa] border border-[#e2e4e8] rounded-xl text-[#0d0d0f] px-4 py-3 text-sm outline-none focus:border-[#00e5a0] focus:bg-white transition-colors"
            />
          </div>

          {authMessage && (
            <div className="mb-5 bg-[#fef2f2] border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-sm text-red-700">{authMessage}</p>
            </div>
          )}

          <button
            onClick={handleAuth}
            disabled={authLoading || !email || !password}
            className="w-full bg-[#00e5a0] text-black font-bold rounded-xl py-4 text-sm tracking-widest mb-3 hover:bg-[#00ffc0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {authLoading && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            )}
            {authLoading ? 'One moment…' : isSignUp ? 'CREATE ACCOUNT & JOIN' : 'SIGN IN & JOIN'}
          </button>

          <button
            onClick={() => { setIsSignUp(s => !s); setAuthMessage('') }}
            className="w-full text-[#6b6b7a] text-sm py-2 hover:text-[#0d0d0f] transition-colors"
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
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center text-[#6b6b7a] text-sm">
        Loading…
      </div>
    }>
      <JoinContent />
    </Suspense>
  )
}
