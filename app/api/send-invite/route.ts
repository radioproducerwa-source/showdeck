import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Best-effort per-instance rate limit (serverless instances are ephemeral,
// but this still blunts abuse from a single warm instance).
const sendLog = new Map<string, number[]>()
const RATE_LIMIT = 10 // sends per hour per user
function rateLimited(userId: string): boolean {
  const now = Date.now()
  const windowStart = now - 60 * 60 * 1000
  const recent = (sendLog.get(userId) || []).filter(t => t > windowStart)
  if (recent.length >= RATE_LIMIT) return true
  recent.push(now)
  sendLog.set(userId, recent)
  return false
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function roleLabel(role: string) {
  return role === 'host1' ? 'Host 1' : role === 'host2' ? 'Host 2' : 'Producer'
}

function buildEmail(showName: string, role: string, inviteLink: string, inviterName?: string) {
  const roleName = roleLabel(role)
  const from = inviterName ? `${inviterName} has invited you` : `You've been invited`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to ${showName} on Showdeck</title>
</head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Logo bar -->
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <svg width="20" height="20" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="0" y="4" width="6" height="28" rx="1.5" fill="#00e5a0"/>
                      <rect x="10" y="10" width="6" height="16" rx="1.5" fill="#00e5a0" opacity="0.7"/>
                      <rect x="20" y="0" width="6" height="36" rx="1.5" fill="#00e5a0"/>
                      <rect x="30" y="8" width="6" height="20" rx="1.5" fill="#00e5a0" opacity="0.6"/>
                    </svg>
                  </td>
                  <td style="font-family:monospace;font-weight:700;font-size:15px;letter-spacing:3px;color:#0d0d0f;vertical-align:middle;">
                    SHOWDECK
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e2e4e8;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

              <!-- Green accent header -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#0d0d0f;padding:32px 40px 28px;">
                    <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#00e5a0;">
                      You've been invited
                    </p>
                    <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;line-height:1.2;">
                      ${showName}
                    </h1>
                    <p style="margin:10px 0 0;font-size:13px;color:rgba(255,255,255,0.45);">
                      Joining as ${roleName}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:32px 40px;">
                    <p style="margin:0 0 24px;font-size:15px;color:#3d3d4a;line-height:1.6;">
                      ${from} to collaborate on <strong style="color:#0d0d0f;">${showName}</strong> as <strong style="color:#0d0d0f;">${roleName}</strong> on Showdeck — the podcast planning tool built for teams.
                    </p>

                    <!-- CTA button -->
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:#00e5a0;border-radius:10px;">
                          <a href="${inviteLink}"
                            style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0d0d0f;text-decoration:none;">
                            Accept Invite
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:24px 0 0;font-size:12px;color:#9a9aaa;line-height:1.6;">
                      Or copy this link into your browser:<br/>
                      <a href="${inviteLink}" style="color:#00a870;word-break:break-all;">${inviteLink}</a>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top:1px solid #f0f0f4;padding:20px 40px;">
                    <p style="margin:0;font-size:11px;color:#b0b2bc;line-height:1.6;">
                      This invite was sent via Showdeck. If you weren't expecting it, you can safely ignore this email — the link only works once you sign in.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Bottom spacer -->
          <tr>
            <td style="padding-top:24px;" align="center">
              <p style="margin:0;font-size:11px;color:#c0c2cc;">
                Showdeck · Podcast planning, made together.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 503 })
  }
  const resend = new Resend(process.env.RESEND_API_KEY)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  // Caller must be signed in — their access token comes in the Authorization header.
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  // A user-scoped client: every query below runs under the caller's RLS.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  if (rateLimited(user.id)) {
    return NextResponse.json({ error: 'Too many invites — try again later' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const inviteId = body?.inviteId
  if (!inviteId || typeof inviteId !== 'string') {
    return NextResponse.json({ error: 'Missing inviteId' }, { status: 400 })
  }

  // Load the invite under the caller's RLS, then verify they own the show.
  const { data: invite, error: inviteErr } = await supabase
    .from('show_invites').select('*').eq('id', inviteId).maybeSingle()
  if (inviteErr || !invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }
  const { data: show, error: showErr } = await supabase
    .from('shows').select('id, name, owner_id').eq('id', invite.show_id).maybeSingle()
  if (showErr || !show || show.owner_id !== user.id) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }
  if (!EMAIL_RE.test(invite.email || '')) {
    return NextResponse.json({ error: 'Invite has an invalid email address' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles').select('display_name').eq('id', user.id).maybeSingle()
  const inviterName = profile?.display_name || user.email || undefined

  // Link is built server-side from the invite record — never trusted from the client.
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://showdeck.live'
  const inviteLink = `${origin}/join?token=${encodeURIComponent(invite.token)}`

  const from = process.env.RESEND_FROM || 'Showdeck <team@showdeck.live>'
  const safeShowName = escapeHtml(show.name || 'a show')
  const safeInviter = inviterName ? escapeHtml(inviterName) : undefined

  const { error } = await resend.emails.send({
    from,
    to: invite.email,
    subject: `You've been invited to ${show.name} on Showdeck`,
    html: buildEmail(safeShowName, invite.role, inviteLink, safeInviter),
  })

  if (error) {
    console.error('Resend error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
