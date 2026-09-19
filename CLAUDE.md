# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Setup

`.env.local` and `node_modules` are both lost every Codespace restart. Recreate/reinstall before starting:

```bash
echo 'NEXT_PUBLIC_SUPABASE_URL=https://vunsttbpoudtrclokmdv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_E4xaXl0v8o9nPcnAKNMrfA_TasKWIaM' > .env.local
npm install
```

## Commands

```bash
npm run dev      # start dev server on localhost:3000
npm run build    # production build (also type-checks)
npm run lint     # ESLint — run this, see note below
npx tsc --noEmit # type-check without building
```

No test suite exists — verify manually on the dev server and on showdeck.live after pushing.

**Always run `npm run lint` on new/changed components, not just `tsc` and `build`.** Lint errors do not fail the build, so React Compiler violations (refs mutated during render, setState directly in an effect) slip through silently otherwise. Lint should report **0 errors**; ~20 warnings are expected and benign (`<img>` hints, intentional mount-once effect deps).

## Deploy flow

Work on the branch, then merge to `main` — Vercel auto-deploys from `main` only. A preview deployment is built for the branch; **showdeck.live only updates after merging to `main`**.

## Architecture

Next.js 16 app router (`app/`), all pages are `'use client'` except the root layout. Supabase for auth, database, storage, and Realtime. Sentry for error monitoring.

### Auth pattern
No middleware. Show-scoped pages should use the **`useShowAccess(showId)` hook** (`lib/useShowAccess.ts`), which handles auth, the owner-or-member check, redirects, and an explicit error state. `useAuthGuard()` in the same file covers non-show pages. Some older pages still hand-roll `supabase.auth.getUser()` in a `useEffect` — prefer the hook when touching them.

Auth supports email/password, Google and Facebook OAuth. New users land on `/profile/setup` to create a profile row.

### Data model (key tables)
- `profiles` — one row per user (display name, avatar)
- `shows` — owned by `owner_id`; `show_type` (`podcast`, `radio`, `breakfast_radio`, `drive`, `evening`, `other`) drives default sections; also `header_color` (drives the page banners) and `episode_number_start` (archive numbering for shows that migrated in mid-run)
- `show_members` — join table giving non-owners access
- `show_invites` — invites with a `token` and `expires_at` (14 days)
- `episodes` — belong to a show; `archived` boolean
- `sections` — per-episode section definitions (name + icon + sort_order)
- `section_content` — keyed by `(episode_id, section_name, role)`. **`role` is `communal` | `host1` | `host2` | `producer`** — `communal` is the shared "Topics & Talking Points" box
- `section_links` — per-section links, keyed by `(episode_id, section_name)`
- `show_messages` — per-show live chat (see Realtime below)
- `show_ideas` / `show_idea_columns` — the Ideas Board; columns have a `mode` (`permanent` | `weekly`) and `last_cleared_week`
- `radio_plans` — per-slot runsheet data keyed by `(show_id, plan_date, hour, slot_key)`
- `guests` — show-scoped address book
- `radio_templates` / `section_templates` — saved layout templates
- `show_slot_layout` — per-show radio time-slot customisation
- `recurring_segments` — segments that auto-populate radio plans

### RLS pattern
All tables use RLS. The general access pattern:
- Read/write: `shows.owner_id = auth.uid()` OR `show_id IN (SELECT show_id FROM show_members WHERE user_id = auth.uid())`
- Delete: owner only
- `section_content` / `section_links` have no direct `show_id` — access is checked via `episodes → shows`
- Cron routes use the service role key and bypass RLS

**Invites and memberships are a special case.** Clients cannot read `show_invites` or insert into `show_members` directly. Both go through `SECURITY DEFINER` functions:
- `get_invite_by_token(p_token)` — returns a single invite row for the `/join` page
- `accept_invite(p_token)` — validates, creates the membership and marks the invite used, atomically

Wrap `auth.uid()` as `(SELECT auth.uid())` in policies so Postgres evaluates it once per query.

After any RLS change, **test immediately on production**, not just localhost. Never layer new policies on old ones — drop all policies on the table and recreate cleanly (a past incident was caused by stale policies lurking under new ones).

### Realtime
`show_messages` is published to `supabase_realtime`. Any new table needing live updates must be added to that publication (`ALTER PUBLICATION supabase_realtime ADD TABLE <t>;`) or inserts will save but never broadcast.

### Supabase client
Single shared browser client at `lib/supabase.ts`; pages import `{ supabase }` from there. API routes build their own client — a user-scoped one (anon key + the caller's bearer token) for anything acting as the user, or the service-role key for admin work.

### Page structure
- `/` — login/signup
- `/dashboard` — owned + member shows
- `/shows/[showId]` — show detail. Podcast view shows the episode whiteboard and Ideas Board **side by side** (no tabs); radio keeps Runsheet/Ideas tabs
- `/planner/[showId]` — podcast episode planner
- `/radio-planner/[showId]` — radio runsheet (wraps `RadioPlannerPanel`)
- `/archive/[showId]`, `/guests/[showId]`, `/show-settings/[showId]`, `/join`, `/profile`, `/profile/setup`, `/privacy`, `/terms`

### Planner behaviour (important)
- **Host note panels are opt-in per segment.** A segment shows the communal topics box plus "+ &lt;host&gt;" buttons; a host's note area appears only once added, or if a note row already exists (so existing episodes are unchanged). Adding one writes an empty `section_content` row so it survives a reload.
- **Notes are rich text stored as HTML** — see below.
- `section_content` is keyed by section **name**, not id. Renaming a section orphans its content; duplicate names within an episode collide.

### Rich text notes
Planner notes use Tiptap (`components/RichTextEditor.tsx`): bold, italic, underline, bullet and numbered lists. The toolbar only shows while the field is focused.

Content is HTML in `section_content.content`. **Never assume the stored value is plain text** — use `lib/richText.ts`:
- `toEditorHtml(v)` — load into the editor; upgrades legacy plain text, preserving line breaks
- `htmlToPlain(v)` — for previews, word counts, status, search
- `isEmptyNote(v)` — handles the editor's empty `<p></p>`
- `htmlToBlocks(v)` — styled runs + list markers, used by the PDF export

`htmlToBlocks`/`htmlToPlain` use `DOMParser`, so they only work client-side (they degrade gracefully on the server — don't render their output during SSR or you'll get a hydration mismatch).

List styling lives in `.showdeck-prose` in `globals.css`, because Tailwind preflight strips list markers.

### Auto-save pattern (podcast planner)
`saveStatus` is `'saved' | 'saving' | 'unsaved' | 'error'`, debounced 800ms per field key. Status is derived from a dirty-key set plus an in-flight counter, so a completing save can't falsely report "saved" while another field is still dirty. Pending saves are flushed on unmount and `beforeunload`. The radio planner has its own `saveError` boolean.

### Components
- `RichTextEditor` — Tiptap notes editor (`immediatelyRender: false` to avoid SSR mismatch)
- `ShowChat` — floating per-show live chat, rendered on the show page, planner and radio planner
- `Toast` / `useToast` — shared toast hook + renderer; error toasts red, success dark. **Pass `true` as the second arg for failures** or they render as success
- `RadioPlannerPanel` — the whole radio runsheet; manages its own state and its own internal toast
- `GlobalSearch` — cross-show search (uses `fetchAccessibleShows` so members see joined shows)
- `icons.tsx` — the SVG icon set + `Spinner` / `PageLoader`
- `Logo` — SVG logo with a `size` prop

### Design conventions
There is **no theme system** — the old light/dark/midnight/charcoal themes and `--t-*` variables were removed. The palette is hardcoded: background `#f7f8fa`, surfaces white, borders `#e2e4e8`, text `#0d0d0f`, muted `#6b6b7a`, brand green `#00e5a0` (hover `#00d494`, dark `#00a870`).

- **No emoji in interface chrome** — use `components/icons.tsx`. Emoji the *user* picked (section icons, idea text) is content and stays.
- Buttons: primary `bg-[#00e5a0] text-black font-semibold rounded-xl hover:bg-[#00d494] active:scale-[0.99]`; secondary white + `border-[#e2e4e8]`. **Sentence case**, never ALL-CAPS.
- Loading: `PageLoader` / `Spinner`, never bare "Loading…" text.
- Workspace pages are full-bleed: `max-w-[2000px] mx-auto px-4 sm:px-8 lg:px-12`. Forms and legal pages stay narrow deliberately. The planner stays at `max-w-5xl` for readability.
- The show page and planner use full-bleed banners tinted by `show.header_color`, with `contrastText()` picking black/white text.
- Touch targets: drag handles need real padding (~40px hit area), not just an icon.

### API routes
- `POST /api/send-invite` — requires the caller's bearer token, verifies show ownership, builds the invite link server-side and escapes HTML. Takes `{ inviteId }`. Uses `RESEND_API_KEY` / `RESEND_FROM`
- `POST /api/delete-account` — full account deletion via service role (owned shows + children, memberships, profile, storage, auth user)
- `GET /api/cron/archive-episodes` — weekly Vercel cron
- `GET /api/cron/ping` — daily keep-alive so the free-tier Supabase project doesn't pause

Cron routes fail closed if `CRON_SECRET` is unset and return generic errors.

### Monitoring & metadata
Sentry (`@sentry/nextjs`) is wired via `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` and `withSentryConfig` in `next.config.ts`. **Reporting is production-only.** Source maps upload using `SENTRY_AUTH_TOKEN` (set in Vercel); org `showdeck-6h`, project `javascript-nextjs`.

`app/opengraph-image.tsx` generates the social share card; `app/manifest.ts`, `app/apple-icon.tsx` and `app/pwa-icon/` make the site installable as a PWA.

### Known warts
- **Punt Pals hardcoding.** Show ID `8265f874-9732-4b6b-8617-a6c5918c6ca7` is special-cased in the planner: protected sections that auto-insert and can't be deleted (`Last Week's Betting`, `AFL Multis`, `Racing Bets`) and an "Import last week" button. Generalising this into a per-show `show_section_rules` feature is the obvious next refactor.
- `app/planner/[showId]/page.tsx`, `app/shows/[showId]/page.tsx` and `components/RadioPlannerPanel.tsx` are all very large and would benefit from decomposition.

### Database migrations
SQL files live in `supabase/migrations/`. Write a new `.sql` file **and** apply it to production via the Supabase dashboard the same day — the user runs these by hand. Never let production schema drift from the migration files.
