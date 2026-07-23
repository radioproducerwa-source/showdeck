import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Runs daily at 08:00 UTC to keep the Supabase project from pausing due to inactivity.
// Supabase free tier pauses after 1 week of no database activity.
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
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const { error } = await supabase.from('shows').select('id').limit(1)

  if (error) {
    console.error('Ping query failed:', error)
    return NextResponse.json({ error: 'Ping failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}
