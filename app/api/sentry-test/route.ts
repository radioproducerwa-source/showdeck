import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

// TEMPORARY diagnostic — verifies the Sentry pipeline end to end.
// Visit /api/sentry-test once, check the event lands in Sentry, then delete
// this route. It sends a single test event and breaks nothing.
export async function GET() {
  const client = Sentry.getClient()
  const opts = client?.getOptions()

  const eventId = Sentry.captureException(
    new Error('Showdeck Sentry pipeline test — safe to ignore')
  )

  // Serverless functions can exit before the event is transmitted
  const flushed = await Sentry.flush(3000)

  return NextResponse.json({
    ok: true,
    eventId: eventId ?? null,
    flushed,
    // Diagnostics, so a silent failure still tells us why
    sentryInitialised: !!client,
    enabled: opts?.enabled ?? null,
    dsnConfigured: !!opts?.dsn,
    nodeEnv: process.env.NODE_ENV,
  })
}
