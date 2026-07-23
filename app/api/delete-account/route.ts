import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Fully deletes the calling user's account: owned shows and all their child
// rows, memberships, invites they created, profile, and the auth user itself.
// Uses the service role — the caller is identified by their access token.
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: { user }, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const userId = user.id

  try {
    // Owned shows and every child row under them
    const { data: shows, error: showsErr } = await admin.from('shows').select('id').eq('owner_id', userId)
    if (showsErr) throw showsErr
    const showIds = (shows || []).map(s => s.id)

    if (showIds.length > 0) {
      const { data: eps, error: epsErr } = await admin.from('episodes').select('id').in('show_id', showIds)
      if (epsErr) throw epsErr
      const episodeIds = (eps || []).map(e => e.id)

      if (episodeIds.length > 0) {
        await admin.from('section_links').delete().in('episode_id', episodeIds)
        await admin.from('section_content').delete().in('episode_id', episodeIds)
        await admin.from('sections').delete().in('episode_id', episodeIds)
        await admin.from('episodes').delete().in('id', episodeIds)
      }

      // Show-scoped tables (some cascade from shows, but delete explicitly so
      // this route doesn't depend on FK configuration)
      for (const table of ['radio_plans', 'show_invites', 'show_members', 'show_ideas',
        'show_idea_columns', 'guests', 'radio_templates', 'section_templates',
        'recurring_segments', 'show_slot_layout']) {
        await admin.from(table).delete().in('show_id', showIds)
      }
      await admin.from('shows').delete().in('id', showIds)
    }

    // Memberships in other people's shows + profile
    await admin.from('show_members').delete().eq('user_id', userId)
    await admin.from('profiles').delete().eq('id', userId)

    // Uploaded avatar files (best-effort)
    const { data: files } = await admin.storage.from('show-logos').list('', { search: `profile-${userId}` })
    if (files && files.length > 0) {
      await admin.storage.from('show-logos').remove(files.map(f => f.name))
    }

    // Finally the auth user
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) throw delErr

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('delete-account failed:', e)
    return NextResponse.json({ error: 'Deletion failed — contact support' }, { status: 500 })
  }
}
