'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'

type ShowAccess =
  | { status: 'loading'; user: null; show: null; isOwner: false }
  | { status: 'ready'; user: any; show: any; isOwner: boolean }
  | { status: 'error'; user: null; show: null; isOwner: false; message: string }

/**
 * Auth + access guard for show-scoped pages.
 * - Redirects to / when unauthenticated.
 * - Redirects to /dashboard when the show doesn't exist or the user is
 *   neither owner nor member (or not owner when ownerOnly is set).
 * - Resolves to an explicit error state on network/query failure instead of
 *   leaving the page stuck on a loading screen.
 */
export function useShowAccess(showId: string, opts?: { ownerOnly?: boolean }) {
  const [state, setState] = useState<ShowAccess>({ status: 'loading', user: null, show: null, isOwner: false })
  const router = useRouter()
  const ownerOnly = !!opts?.ownerOnly

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (ignore) return
        if (!user) { router.push('/'); return }

        const { data: show, error } = await supabase.from('shows').select('*').eq('id', showId).maybeSingle()
        if (ignore) return
        if (error) { setState({ status: 'error', user: null, show: null, isOwner: false, message: error.message }); return }
        if (!show) { router.push('/dashboard'); return }

        const isOwner = show.owner_id === user.id
        if (!isOwner) {
          if (ownerOnly) { router.push('/dashboard'); return }
          const { data: membership, error: memberErr } = await supabase
            .from('show_members').select('id').eq('show_id', showId).eq('user_id', user.id).maybeSingle()
          if (ignore) return
          if (memberErr) { setState({ status: 'error', user: null, show: null, isOwner: false, message: memberErr.message }); return }
          if (!membership) { router.push('/dashboard'); return }
        }

        setState({ status: 'ready', user, show, isOwner })
      } catch (e: any) {
        if (!ignore) setState({ status: 'error', user: null, show: null, isOwner: false, message: e?.message || 'Something went wrong' })
      }
    })()
    return () => { ignore = true }
  }, [showId, ownerOnly, router])

  return state
}

/**
 * Auth guard for non-show pages. Redirects to / when unauthenticated;
 * optionally redirects to /profile/setup when no profile row exists.
 */
export function useAuthGuard(opts?: { requireProfile?: boolean }) {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [checked, setChecked] = useState(false)
  const router = useRouter()
  const requireProfile = !!opts?.requireProfile

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (ignore) return
        if (!user) { router.push('/'); return }
        if (requireProfile) {
          const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
          if (ignore) return
          if (!prof) { router.push('/profile/setup'); return }
          setProfile(prof)
        }
        setUser(user)
        setChecked(true)
      } catch {
        if (!ignore) setChecked(true)
      }
    })()
    return () => { ignore = true }
  }, [requireProfile, router])

  return { user, profile, checked }
}
