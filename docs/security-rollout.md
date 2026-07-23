# Security rollout runbook

Run these steps in the Supabase SQL editor, in order, ideally at a quiet time
(not right before a show). Each step is safe on its own and each has a rollback.

## Step 0 — Diagnose current state (read-only, run first)

```sql
-- Which tables actually have RLS on?
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- What policies exist right now?
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
```

Paste the output back into Claude Code if anything looks surprising —
especially check that `shows`, `profiles`, and `sections` show `rowsecurity = true`.
If any of those three are `false`, STOP and report back before continuing.

## Step 1 — Episodes + section content

Run the whole file `supabase/migrations/20260723_rls_reset_episodes_section_content.sql`.

It drops every existing policy on `episodes` and `section_content` (this is
what went wrong last time — old policies were layered underneath), recreates
the correct set, and enables RLS.

**Verify immediately** (while staying logged in to showdeck.live in another tab):
refresh the Punt Pals show page and confirm episodes and notes are visible.

**Rollback if anything disappears:**
```sql
ALTER TABLE public.episodes        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_content DISABLE ROW LEVEL SECURITY;
```

## Step 2 — Invites + memberships

Run the whole file `supabase/migrations/20260723_secure_invites_and_members.sql`.

This closes two critical holes (anyone could read all invite tokens; anyone
could add themselves to any show) and adds 14-day invite expiry. Invite
acceptance now happens through a database function, matching the updated
`/join` page code — **deploy the code to Vercel before or together with this
step** (the code is backwards-compatible in display but acceptance requires
the function).

**Verify:** send yourself a test invite from Show Settings to a spare email,
open the link in a private window, and confirm the join flow works end to end.

**Rollback:** re-run the old policies file
`supabase/migrations/20260430_show_invites_and_members.sql` (this restores the
permissive behaviour — only as an emergency measure).

## Step 3 — Confirm the Security Advisor is clean

Supabase Dashboard → Advisors → Security Advisor → "Rerun linter".
All four RLS errors should be gone. Report any that remain.
