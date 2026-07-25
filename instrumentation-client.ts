import * as Sentry from '@sentry/nextjs'

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
  || 'https://9360978f64401d1c7f6aa34c47a08656@o4511794451251200.ingest.us.sentry.io/4511794456952832'

Sentry.init({
  dsn: DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
