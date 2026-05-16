# SHOWDECK — Living Blueprint
*Last updated: May 2026 — Chat 7 Phase 1 complete, persistent save error states added*

> This is a living document. Update it after every session, every lesson, every win and every mistake. The goal: build a product that works so well for Robbie that he'd miss it if it disappeared — then sell it to everyone else.

---

## Part 1 — The Foundations
*Timeless principles that apply to every project, forever.*

### The Product Philosophy
- Build it for yourself first. Solve your own problem properly.
- When it works so well you'd miss it if it disappeared — that's when you sell it.
- You are the target customer. That's an enormous advantage. Use it.
- A product used daily by one real person beats a product half-built for a thousand imaginary ones.

### The Building Philosophy
- Ship something real to a real user as fast as possible. Real feedback beats assumptions.
- Fast and scrappy beats slow and perfect in early stage. Get it working, then refine.
- One feature at a time. Finish it, test it on production, then move to the next.
- If it's not tested on a real device on a real network, it's not done.

### The Debugging Philosophy
- Eliminate the environment layer first (device, network, browser, cache) before touching code.
- Always test on a second device immediately when something isn't working.
- When something breaks after a change — revert first, understand second.
- The simplest explanation is usually right.

---

## Part 2 — The Showdeck Playbook
*Specific to this stack and workflow. Update as the stack evolves.*

### The Stack
- **Framework:** Next.js (TypeScript, Tailwind CSS)
- **Database + Auth:** Supabase
- **Hosting:** Vercel (auto-deploys from GitHub push)
- **Dev environment:** GitHub Codespaces (literate space acorn)
- **AI coding assistant:** Claude Code (in Codespace terminal)
- **Email:** Resend (invites@showdeck.live)
- **DNS:** Cloudflare → Vercel

### Starting a Session (Every Time)
```bash
# 1. Open Codespace: github.com/codespaces → literate space acorn
# 2. Recreate .env.local (lost each session):
echo 'NEXT_PUBLIC_SUPABASE_URL=https://vunsttbpoudtrclokmdv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_E4xaXl0v8o9nPcnAKNMrfA_TasKWIaM' > .env.local

# 3. Start dev server (terminal 1):
npm run dev

# 4. Launch Claude Code (terminal 2):
claude
```

### Ending a Session (Every Time)
1. Commit and push all changes (`git add . && git commit -m "..." && git push`)
2. Verify Vercel deployment completed successfully
3. Run the smoke test checklist (below)
4. Update the handover doc with what was done and what's next
5. Update this blueprint if any new lessons were learned

### Smoke Test Checklist (5 minutes, run before closing every session)
- [ ] Can log in at showdeck.live on a real device (phone)
- [ ] Dashboard shows correct shows
- [ ] Can open the podcast planner and type in a section
- [ ] Auto-save indicator shows "Saved"
- [ ] Can open the radio planner and navigate days
- [ ] No red errors in browser console

### Database Rules (Non-Negotiable)
- RLS enabled on every table from day one
- Migrations written AND applied to production the same day
- Never let production drift from local schema
- After any RLS change — test immediately on production, not just localhost
- One policy per action, clear descriptive names, no duplicates

### Claude Code Prompting Standards
**A good prompt has:**
- The exact file path(s) involved
- The exact table/column names if database is involved
- What's currently happening vs what should happen
- Numbered list of specific things to do
- What NOT to break

**Example of a bad prompt:**
> "Fix the dashboard"

**Example of a good prompt:**
> "The dashboard at app/dashboard/page.tsx shows 'No shows yet' for user robbievonklitzing@gmail.com (ID: 43b722c6...) even though 2 shows exist in the database with that owner_id. RLS is enabled on the shows table. Please: 1) Read the dashboard file and show me the exact Supabase query, 2) Check lib/supabase.ts to confirm auth is passed correctly, 3) Fix the query so it returns shows where owner_id = user OR user is in show_members."

**One job per prompt.** Never mix a bug fix with a feature addition.

---

## Part 3 — Session Log
*What we built, what we learned, what we'd do differently. Grows every session.*

### Chat 1 — Project Kickoff
**Built:** Login/signup page, dashboard, basic show structure, Supabase setup, Vercel deploy
**Learned:** Get production working before building features. The local/production gap causes real bugs.
**Do differently:** Confirm login working on showdeck.live before writing any planner code.

### Chat 2 — Episode Planner + Auto-Save
**Built:** Episode planner with auto-save, section_content table, save indicator
**Learned:** Supabase caching on Vercel can serve stale JS bundles. Hard refresh doesn't always fix it — a new deployment does.
**Do differently:** After major rewrites, always trigger a fresh Vercel deployment and test in incognito.

### Chat 3 — Radio Planner + Features
**Built:** Radio planner (3-column grid), week carousel, episode archive, PDF export, show logo upload, import last week's bets, save as template
**Learned:** Big feature sessions work well when each feature has a clear brief. The sticky note whiteboard was a good example of building something, moving on, keeping it as a revert option.
**Do differently:** Nothing major — this was the most productive session.

### Chat 4 — Invite System + Polish
**Built:** Invite system with Resend email, join page, guest address book, mobile optimisation, show settings
**Learned:** Silent failures are the worst bugs. The show_members insert was failing with no error shown to the user, and the code marked the invite as accepted anyway — permanently locking out the invited user. Always check insert results.
**Do differently:** Error handling first, feature second. Every database write should have a visible failure state.

### Chat 5 — RLS + DNS + Dashboard Bug
**Built:** Fixed RLS on shows table, fixed invite acceptance flow, fixed DNS/Cloudflare setup
**Learned:**
- The Zscaler corporate blocker on the work computer blocked showdeck.live regardless of network. An iPhone test at the start would have saved 1+ hour.
- Duplicate RLS policies cause silent conflicts. Always nuke and recreate cleanly rather than layering new policies on old ones.
- The www → showdeck.live redirect was backwards in Vercel. showdeck.live should always be the primary domain pointing to Production.
**Do differently:** Test on iPhone first when anything isn't working on the work computer. Never assume it's the code.

### Chat 7 — Phase 1 Complete + Error States
**Built:** Persistent save error states in both planners — red "Save failed — check connection" indicator stays visible in the header after a failed auto-save, not just during the toast. Added `CLAUDE.md` to the repo so Claude Code auto-loads project context at the start of every session.
**Confirmed:** Nick and Carly both fully onboarded. Phase 1 is complete.
**Learned:** "Unsaved" and "Save failed" need to be visually distinct — amber for pending, red for actual failure. A toast that fades is not enough; the indicator needs to persist until the next successful save.
**Do differently:** Nothing — this was a clean, focused session.

### Chat 6 — Settings Fix + Commercial Planning + Security
**Built:** Owner-only settings visibility ✅, interactive day selector ✅, Google OAuth login ✅, auto-expanding text areas ✅
**Planned:** Full commercial readiness roadmap, pricing model, pitch framework, OAuth security plan
**Discovered:** showdeck-one.vercel.app works on SCA work computers (Zscaler doesn't block vercel.app) — free workaround, no new domain needed
**Learned:** SCA tech team flagged password-based auth as a security liability. Google/Facebook OAuth is the right move before going commercial — takes security out of Showdeck's hands and looks more professional to corporate clients.
**Do differently:** Should have planned OAuth from the start. For any future project with commercial ambitions, OAuth-first from day one.

---

## Part 4 — The Product Blueprint
*Where Showdeck is going. Evolves as the product grows.*

### Phase 1 — Works Perfectly for Robbie
*Current phase. Done when Showdeck is a tool Robbie uses every single week without thinking about it.*

**Definition of done:**
- [ ] Robbie uses it for every Punt Pals episode without friction
- [ ] Robbie uses it for Robbie & Carly prep without friction
- [ ] Nick can log in and fill in his sections collaboratively
- [ ] The invite flow works reliably for new co-hosts
- [ ] No known bugs that interrupt real use

**Remaining tasks for Phase 1 (priority order):**
1. Settings page — only visible to show owner *(in progress)*
2. Interactive day selector on show detail page *(in progress)*
3. Fix RLS on episodes, section_content, radio_plans tables
4. Generic default sections for new users (not AFL/betting ones)
5. Test full invite flow end to end with Nick
6. Supabase email confirmation template — Showdeck branded
7. Show deletion option

### Phase 2 — Ready to Show Someone Else
*Start when Phase 1 is solid. Done when a stranger can sign up and get value without help.*

**What needs to happen:**
- Onboarding flow — new user creates a show and understands what to do without instructions
- Generic sections that make sense for any podcast or radio show
- Settings page fully functional
- Error states visible everywhere (no silent failures)
- Mobile experience polished on all core flows
- Supabase security fully locked down (RLS on all tables)

### Phase 3 — Sellable to Radio Networks
*The pitch. Corporate radio is the target market — needs to look premium and broadcast-ready.*

**What radio networks need to see:**
- Multi-show management (one network, many shows)
- Team management (assign roles across shows)
- Broadcast-ready PDF runsheet export
- Audit trail (who filled in what, when)
- White-label potential (their branding, not Showdeck's)
- Data security story (where is our data stored, who can see it)

**The pitch:**
> "Every breakfast radio show in Australia is still running on spreadsheets and WhatsApp groups. Showdeck replaces that with a collaborative workspace built for how radio actually works — segment by segment, host by host, ready to print before you go on air."

---

## Part 4b — Commercial Readiness Roadmap
*The four layers of making Showdeck a product people pay for.*

### The Four Layers

| Layer | What it means | Status |
|-------|--------------|--------|
| **Stability** | It doesn't break | 🟡 In progress |
| **Reliability** | It's always available | 🔴 Not started |
| **Usability** | A stranger can figure it out | 🔴 Not started |
| **Trust** | Users feel safe putting their work in it | 🔴 Not started |

---

### Layer 1 — Stability (Fix Before Anyone Else Joins)

**Known gaps — fix these now:**
- [ ] RLS not enabled on episodes, section_content, radio_plans — security risk
- [ ] Settings page visible to non-owners — ✅ DONE
- [ ] No error states on save failures — user has no idea if auto-save breaks
- [ ] Silent failures on invite flow in edge cases
- [ ] Generic sections for new users not done — new signups get AFL/betting sections
- [ ] Password-based auth is a security liability — move to Google/Facebook OAuth (see Security section below)

**The most important test:**
Have Nick sign up completely fresh, without Robbie helping him, and watch where he gets confused or stuck. That's the real bug list.

**Claude Code prompt when ready:**
```
Enable RLS on the following tables with appropriate policies that don't break existing functionality:
- episodes: users can read/write episodes for shows they own or are a member of (via show_members)
- section_content: users can read/write their own content for episodes they have access to
- radio_plans: users can read/write radio plans for shows they own or are a member of
Test each one after enabling to confirm the planner still loads and saves correctly.
```

---

### Security — OAuth / Social Login
*Flagged by SCA tech team. High priority before going commercial.*

**The problem with password-based auth:**
- Showdeck stores hashed passwords — if the database is breached, user credentials are exposed
- Most people reuse passwords — a breach affects their other accounts too
- Corporate radio networks will ask about this in any security conversation
- Showdeck is responsible for password reset flows, brute force protection, email verification

**The solution — Google and Facebook OAuth:**
- User clicks "Sign in with Google" — Google handles everything
- Supabase receives a verified token, no passwords stored anywhere
- If Showdeck's database is breached, there are no passwords to expose
- Looks more professional and trustworthy to new users
- Corporate networks are more comfortable with Google SSO than custom passwords

**Implementation plan:**
1. Add Google OAuth in Supabase dashboard (Authentication → Providers → Google) — requires a Google Cloud project and OAuth credentials
2. Add "Sign in with Google" button to login page
3. Add Facebook OAuth as secondary option
4. Keep email/password as fallback during transition
5. Existing users re-link their account on next login

**Priority:** Do this before opening to users outside the core team.

**Claude Code prompt when ready:**
```
Add Google OAuth login to the Showdeck login page (app/page.tsx).

Supabase already supports OAuth — we need to:
1. Add a "Sign in with Google" button to the login form, styled to match the existing green/dark design
2. Wire it up using supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://showdeck.live/dashboard' } })
3. Keep the existing email/password form as a fallback option
4. Add a visual divider between OAuth and email/password (e.g. "or continue with email")
5. Make sure the button works on both showdeck.live and showdeck-one.vercel.app

Note: Google OAuth credentials need to be configured in Supabase dashboard (Authentication → Providers → Google) before testing. I will do that separately.
```

---

### Layer 2 — Reliability (Always Available)

**Current risks:**
- Supabase free plan pauses after 7 days inactivity — unacceptable commercially
- No monitoring — site goes down and nobody knows until a user complains
- No documented backup strategy

**Actions:**
- [ ] Upgrade Supabase to Pro ($25/month) before going commercial — eliminates pause, adds daily backups
- [ ] Set up UptimeRobot (free) — pings showdeck.live every 5 minutes, emails if down
- [ ] Set up Vercel monitoring alerts

**When to do this:** Before inviting anyone outside the core team.

---

### Layer 3 — Usability (A Stranger Can Figure It Out)

**Current gaps:**
- No onboarding flow — new user lands on dashboard with no guidance
- Empty states don't explain what to do next
- No help text or tooltips anywhere
- Error messages are technical, not human-readable

**Actions:**
- [ ] Onboarding flow — first login walks user through creating a show and adding a section
- [ ] Empty states with clear next actions ("No episodes yet — plan your first one →")
- [ ] Human-readable error messages throughout
- [ ] **The stranger test** — watch one person who has never seen Showdeck try to use it. Don't help them. Write down every moment they hesitate.

**When to do this:** Month 2 — after Nick and Carly are fully stable.

---

### Layer 4 — Trust (Users Feel Safe)

**What corporate radio networks will ask:**
- Where is our data stored? *(Supabase — AWS ap-southeast-2 Sydney)*
- Who can see it? *(Only your team, enforced by RLS)*
- What happens if it goes down? *(Need an answer for this)*
- Can we get our data out? *(No export feature yet)*
- Is there a privacy policy? *(No)*
- Is there terms of service? *(No)*

**Actions:**
- [ ] Privacy policy page (use a generator for v1, customise later)
- [ ] Terms of service page
- [ ] Data export feature — download all show data as CSV/PDF
- [ ] Upgrade Supabase to Pro (covers the backup/recovery story)
- [ ] Document the data security story in plain English

**When to do this:** Month 3 — before any commercial conversation.

---

### The Master Checklist — Commercial Readiness

#### Now (next 2 weeks) — solid for the core team ✅ COMPLETE
- [x] RLS on all tables ✅
- [x] Scrollable/expandable text areas ✅
- [x] Error states visible everywhere ✅
- [x] Generic sections for new users ✅
- [x] Nick fully onboarded and using it independently ✅
- [x] Carly onboarded on radio planner ✅
- [x] Settings page owner-only ✅
- [x] Interactive day selector working ✅
- [x] Show deletion option ✅

#### Month 2 — ready for strangers
- [x] Google OAuth login live ✅
- [x] Empty states with clear next actions ✅
- [x] Human-readable error messages ✅
- [x] Mobile experience polished ✅
- [ ] Onboarding flow for new users
- [ ] Upgrade Supabase to Pro
- [ ] UptimeRobot monitoring live
- [ ] The stranger test completed and bugs fixed

#### Month 3 — sellable
- [ ] Privacy policy live at showdeck.live/privacy
- [ ] Terms of service live at showdeck.live/terms
- [ ] Data export feature
- [ ] Pricing page (even if it's just "coming soon")
- [ ] Short demo video of the core workflow
- [ ] One real testimonial (Robbie, Nick, or Carly)
- [ ] Pitch deck ready for radio networks

---

### The Pricing Model

**Structure:** Per show per month — not per user, because teams are fluid in radio.

| Plan | Price | What's included |
|------|-------|----------------|
| **Free** | $0 | 1 show, 1 host, basic planner — gets people in the door |
| **Pro** | $19/month per show | Unlimited hosts, radio planner, PDF export, guest book, templates |
| **Network** | Custom | Multiple shows, admin dashboard, white-label, priority support |

**Why this works for radio:** A network running 5 breakfast shows pays per show, not per the 20 people who touch those shows. Clean, predictable, scales with their business.

---

### The Pitch (When Ready)

> "Every breakfast radio show in Australia is still running on spreadsheets and WhatsApp groups. Showdeck replaces that with a collaborative workspace built for how radio actually works — segment by segment, host by host, ready to print before you go on air. Built by a radio producer, for radio producers."

**The unfair advantage:** Robbie is the target customer. He built this for himself. That story is more powerful than any feature list.

---

## Part 5 — Lessons for the Next Project
*Apply these from day one next time.*

### The Non-Negotiables
1. **Production working before features.** Login → dashboard → one core feature, all tested on a real device, before writing anything else.
2. **RLS on from day one.** Not as an afterthought. Every table, from the start.
3. **Migrations applied same day.** Write it, apply it, commit it. Never let prod drift.
4. **Test on a real device, real network, every session.** Not just localhost.
5. **One job per Claude Code prompt.** No mixing. No multitasking.
6. **Update the handover doc before closing the session.** Always.
7. **OAuth from day one.** Google login first, email/password as fallback. Never store passwords if you can avoid it.

### The Week 1 Checklist for Any New Project
- [ ] Repo created, Vercel connected, auto-deploy working
- [ ] Supabase project created, RLS enabled on all tables from day one
- [ ] Login working on production (not just localhost)
- [ ] One real user confirmed working end to end
- [ ] .env.local documented (but not committed)
- [ ] BLUEPRINT.md created in repo
- [ ] Handover doc template ready for first session

### The Stack That Works
For a collaborative web app with auth, database, and real-time features:
- **Next.js** (TypeScript + Tailwind) — fast to build, easy to deploy
- **Supabase** — auth + database + storage + RLS in one place
- **Vercel** — zero-config deployment, auto from GitHub
- **Resend** — transactional email, easy domain verification
- **Cloudflare** — DNS management, free tier is enough
- **GitHub Codespaces** — dev environment that works anywhere (except work computers with Zscaler)
- **Claude Code** — primary coding tool, works best with specific structured prompts

---

*This document is a living record. Every session adds to it. Every mistake makes the next project better.*