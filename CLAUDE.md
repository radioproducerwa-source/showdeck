# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Setup

The `.env.local` file is lost every Codespace restart. Recreate it before starting:

```bash
echo 'NEXT_PUBLIC_SUPABASE_URL=https://vunsttbpoudtrclokmdv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_E4xaXl0v8o9nPcnAKNMrfA_TasKWIaM' > .env.local
```

## Commands

```bash
npm run dev      # start dev server on localhost:3000
npm run build    # production build (also type-checks)
npm run lint     # ESLint
npx tsc --noEmit # type-check without building
```

No test suite exists — verify changes manually on the running dev server and on showdeck.live after pushing.

## Architecture

Next.js 16 app router (`app/`), all pages are `'use client'` except the root layout. Supabase is used for auth, database, and file storage. Vercel auto-deploys from `main`.

### Auth pattern
Every page fetches the current user via `supabase.auth.getUser()` in a `useEffect`, then redirects to `/` if unauthenticated. There is no middleware. Auth supports email/password and Google OAuth (redirects to `/dashboard` on success).

After login, new users are redirected to `/profile/setup` to create a profile row. The dashboard checks for this profile and redirects back to setup if it's missing.

### Data model (key tables)
- `profiles` — one row per user (display name, avatar)
- `shows` — owned by `owner_id`; has a `show_type` field (`podcast`, `radio`, `breakfast_radio`, `drive`, `evening`, `other`) that drives default sections
- `show_members` — join table giving non-owners access to a show
- `show_invites` — pending invites with a `token` for the join link
- `episodes` — belong to a show; have `archived` boolean
- `sections` — ordered list of section definitions for a show (name + icon)
- `section_content` — per-episode content keyed by `(episode_id, section_name, role)`; `role` is `host1`, `host2`, or `producer`
- `radio_plans` — per-slot runsheet data keyed by `(show_id, plan_date, hour, slot_key)`
- `guests` — show-scoped address book
- `radio_templates` / `section_templates` — saved layout templates
- `show_slot_layout` — per-show customisation of radio time slots
- `recurring_segments` — segments that auto-populate radio plans

### RLS pattern
All tables use RLS. The access pattern throughout is:
- Read/write: `shows.owner_id = auth.uid()` OR `show_id IN (SELECT show_id FROM show_members WHERE user_id = auth.uid())`
- Delete: owner only
- `section_content` has no direct `show_id` — access is checked via `episodes → shows`
- The cron job at `/api/cron/archive-episodes` uses the service role key and bypasses RLS

After any RLS change, test immediately on production — not just localhost. Never layer new policies on old ones; nuke and recreate cleanly.

### Supabase client
There is a single shared browser client at `lib/supabase.ts`. All pages import `{ supabase }` from there directly — no server-side client.

### Page structure
- `/` — login/signup (email + Google OAuth)
- `/dashboard` — lists owned shows + shows the user is a member of
- `/shows/[showId]` — show detail: episode list, radio week preview, sticky-note whiteboard, day selector for radio
- `/planner/[showId]` — podcast episode planner with auto-save, drag-to-reorder sections, per-role content (host1/host2/producer), links, PDF export
- `/radio-planner/[showId]` — radio runsheet (wraps `RadioPlannerPanel`)
- `/archive/[showId]` — archived episodes
- `/guests/[showId]` — guest address book
- `/show-settings/[showId]` — owner-only settings, invite management
- `/join` — invite acceptance flow (token in query string)
- `/profile/setup` — first-time profile creation

### Auto-save pattern (podcast planner)
`saveStatus` is `'saved' | 'saving' | 'unsaved' | 'error'`. Debounced 800ms timers per field key. On failure, status becomes `'error'` (persistent red indicator in header) and a toast fires. The radio planner uses a separate `saveError` boolean for the same persistent indicator.

### Components
- `Toast` / `useToast` — shared toast hook + renderer (`components/Toast.tsx`). Phases: `'in'` → auto-transitions to `'out'` after 1800ms. Error toasts are red, success toasts are dark.
- `RadioPlannerPanel` — the entire radio runsheet UI, manages its own state and has its own internal toast (not using the shared `useToast` hook)
- `GlobalSearch` — cross-show search in the nav header
- `Logo` — SVG logo component with a `size` prop

### Theming
Four themes: `light` (default), `dark`, `midnight`, `charcoal`. Stored in `localStorage` + a `showdeck_theme` cookie. The root layout reads the cookie server-side and injects CSS variables as inline styles on `<html>`. Use `--t-*` CSS variables in new UI rather than hardcoded hex values.

### API routes
- `POST /api/send-invite` — sends invite email via Resend (`RESEND_API_KEY` env var required)
- `GET /api/cron/archive-episodes` — Vercel cron job, uses `SUPABASE_SERVICE_ROLE_KEY`

### Database migrations
SQL files live in `supabase/migrations/`. Write a new `.sql` file and apply it to production via the Supabase dashboard the same day. Never let production schema drift from the migration files.
