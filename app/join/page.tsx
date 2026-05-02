'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
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
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 flex flex-col h-full p-12">
        <div className="flex items-center gap-3">
          <LogoIcon size={28} />
          <span
            className="text-white font-bold text-xl tracking-[0.2em]"
            style={{ fontFamily: 'monospace' }}
          >
            SHOWDECK
          </span>
        </div>

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

        <p className="text-white/20 text-xs tracking-widest font-medium">
          Podcast planning, made together.
        </p>
      </div>

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
  const [isSignUp, setIsSignUp] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [authMessageInfo, setAuthMessageInfo] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  // Prevent double-acceptance if onAuthStateChange fires while acceptance is in progress
  const acceptingRef = useRef(false)

  const roleLabel = (r: string) =>
    r === 'host1' ? 'Host 1' : r === 'host2' ? 'Host 2' : 'Producer'

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }

    // onAuthStateChange is the reliable entry point for both cases:
    //   INITIAL_SESSION — user was already logged in (or no session yet)
    //   SIGNED_IN       — user just confirmed their email and was redirected back here
    // Using getUser() alone races against the hash-fragment token exchange on redirect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await handleAuthenticatedUser(session.user.id)
        } else if (event === 'INITIAL_SESSION') {
          // No session on page load — load invite details then show the auth form
          await loadInviteForDisplay()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [token])

  // Loads invite data for display purposes only (unauthenticated path)
  const loadInviteForDisplay = async () => {
    const { data: inv } = await supabase
      .from('show_invites')
      .select('id, show_id, email, role, accepted, token, shows(name)')
      .eq('token', token as string)
      .single()

    if (!inv) { setStatus('invalid'); return }
    if (inv.accepted) { setStatus('already_accepted'); return }

    setInvite(inv)
    setShowName((inv.shows as any)?.name || '')
    setEmail(inv.email || '')
    setStatus('auth_required')
  }

  // Called any time we know the user is authenticated — always fetches fresh invite state
  const handleAuthenticatedUser = async (userId: string) => {
    if (acceptingRef.current) return
    acceptingRef.current = true

    const { data: inv } = await supabase
      .from('show_invites')
      .select('id, show_id, email, role, accepted, user_id, token, shows(name)')
      .eq('token', token as string)
      .single()

    if (!inv) { setStatus('invalid'); acceptingRef.current = false; return }

    setInvite(inv)
    setShowName((inv.shows as any)?.name || '')

    if (inv.accepted) {
      // Invite was previously accepted. If it was by this user, ensure their membership
      // exists (guards against a prior silent insert failure) then redirect.
      if (inv.user_id === userId) {
        await ensureMembership(inv, userId)
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
        router.push(profile ? '/dashboard' : '/profile/setup')
      } else {
        setStatus('already_accepted')
      }
      acceptingRef.current = false
      return
    }

    await acceptInvite(inv, userId)
  }

  // Upserts the show_members row — safe to call multiple times
  const ensureMembership = async (inv: any, userId: string) => {
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
  }

  const acceptInvite = async (inv: any, userId: string) => {
    setStatus('accepting')

    // Insert membership first — only mark invite accepted if this succeeds
    const { data: existing } = await supabase
      .from('show_members')
      .select('id')
      .eq('show_id', inv.show_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (!existing) {
      const { error: insertError } = await supabase.from('show_members').insert({
        show_id: inv.show_id,
        user_id: userId,
        role: inv.role,
      })
      if (insertError) {
        setStatus('auth_required')
        setAuthMessage('Something went wrong saving your access. Please try again.')
        acceptingRef.current = false
        return
      }
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
    setAuthMessageInfo(false)

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `https://showdeck.live/join?token=${token}` },
      })
      if (error) {
        // "User already registered" means they signed up before but didn't confirm —
        // switch them to sign-in mode so they can try again
        if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) {
          setIsSignUp(false)
          setAuthMessage('An account with this email already exists. Sign in instead.')
        } else {
          setAuthMessage(error.message)
        }
        setAuthLoading(false)
        return
      }
      if (!data.session) {
        setAuthMessageInfo(true)
        setAuthMessage('Confirmation email sent! Click the link in your inbox to complete joining the show.')
        setAwaitingConfirmation(true)
        setAuthLoading(false)
        return
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setAuthMessage(error.message); setAuthLoading(false); return }
    }

    setAuthLoading(false)
  }

  const resendConfirmation = async () => {
    setResendLoading(true)
    await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `https://showdeck.live/join?token=${token}` },
    })
    setResendLoading(false)
    setResendDone(true)
    setTimeout(() => setResendDone(false), 4000)
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

  // ── Invalid or already accepted ──────────────────────────────────

  if (status === 'invalid' || status === 'already_accepted') return (
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
        <h2 className="text-lg font-bold text-[#0d0d0f] mb-2">Invite unavailable</h2>
        <p className="text-[#6b6b7a] text-sm mb-6">
          This invite link has already been used or has expired.
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
          <div className="flex items-center justify-center gap-2 text-[#6b6b7a] text-sm">
            <svg className="animate-spin w-4 h-4 text-[#00e5a0]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Setting up your access…
          </div>
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
              <p className="text-sm text-[#0d0d0f] leading-snug pt-0.5">
                You've been invited to join{' '}
                {showName && <strong>{showName}</strong>}
                {invite?.role && (
                  <> as <strong>{roleLabel(invite.role)}</strong></>
                )}
              </p>
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
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
              className="w-full bg-[#f7f8fa] border border-[#e2e4e8] rounded-xl text-[#0d0d0f] px-4 py-3 text-sm outline-none focus:border-[#00e5a0] focus:bg-white transition-colors"
            />
          </div>

          {authMessage && (
            authMessageInfo ? (
              <div className="mb-5 bg-[#edfdf6] border border-[#00e5a0]/40 rounded-xl px-4 py-3">
                <div className="flex items-start gap-2.5 mb-3">
                  <svg className="w-4 h-4 text-[#00a870] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-[#0a6b47]">{authMessage}</p>
                </div>
                {awaitingConfirmation && (
                  <button
                    onClick={resendConfirmation}
                    disabled={resendLoading || resendDone}
                    className="text-xs font-semibold text-[#00a870] hover:text-[#007a50] transition-colors disabled:opacity-60"
                  >
                    {resendDone ? '✓ Sent again!' : resendLoading ? 'Sending…' : "Didn't receive it? Resend confirmation email"}
                  </button>
                )}
              </div>
            ) : (
              <div className="mb-5 bg-[#fef2f2] border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-sm text-red-700">{authMessage}</p>
              </div>
            )
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
