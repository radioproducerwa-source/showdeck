import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Runs every Friday at 7:00 UTC = ~5pm AEST / 6pm AEDT
// Triggered by Vercel Cron (see vercel.json)
export async function GET(req: NextRequest) {
  // Fail closed: without a configured secret, nobody gets in.
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceKey)

  // Archive all active (non-archived) podcast episodes
  const { data, error } = await admin
    .from('episodes')
    .update({ archived: true })
    .eq('archived', false)
    .select('id, title, show_id')

  if (error) {
    console.error('Auto-archive failed:', error)
    return NextResponse.json({ error: 'Archive failed' }, { status: 500 })
  }

  console.log(`Auto-archived ${data?.length ?? 0} episode(s) on Friday`)
  return NextResponse.json({ archived: data?.length ?? 0, episodes: data })
}
