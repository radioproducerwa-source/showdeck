-- ============================================================
-- Security hardening: show_invites + show_members
--
-- Fixes three vulnerabilities:
--  1. show_members INSERT policy only checked user_id = auth.uid(),
--     letting any signed-in user add themselves to ANY show.
--  2. show_invites SELECT/UPDATE policies were USING (true) —
--     world-readable (leaking all invite tokens + emails) and
--     world-updatable.
--  3. Invite tokens never expired.
--
-- Invite acceptance now goes through the accept_invite() function
-- (SECURITY DEFINER), so clients never touch show_members or flip
-- invite flags directly. Reading an invite for the join page goes
-- through get_invite_by_token().
-- ============================================================

-- 0. Schema additions --------------------------------------------------

ALTER TABLE show_invites ADD COLUMN IF NOT EXISTS expires_at timestamptz
  DEFAULT (now() + interval '14 days');

-- Backfill: give existing pending invites a fresh 14-day window
UPDATE show_invites SET expires_at = now() + interval '14 days' WHERE expires_at IS NULL;

-- One membership row per user per show (accept_invite relies on this)
CREATE UNIQUE INDEX IF NOT EXISTS show_members_show_user_uniq
  ON show_members (show_id, user_id);

-- 1. Nuke all existing policies on both tables --------------------------

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('show_invites', 'show_members')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 2. show_invites: owner-only ------------------------------------------

ALTER TABLE show_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites_owner_select" ON show_invites
  FOR SELECT USING (
    show_id IN (SELECT id FROM shows WHERE owner_id = (SELECT auth.uid()))
  );

CREATE POLICY "invites_owner_insert" ON show_invites
  FOR INSERT WITH CHECK (
    show_id IN (SELECT id FROM shows WHERE owner_id = (SELECT auth.uid()))
  );

CREATE POLICY "invites_owner_delete" ON show_invites
  FOR DELETE USING (
    show_id IN (SELECT id FROM shows WHERE owner_id = (SELECT auth.uid()))
  );

-- No UPDATE policy: acceptance happens inside accept_invite() below.

-- 3. show_members: no direct inserts -----------------------------------

ALTER TABLE show_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_self_or_owner" ON show_members
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    OR show_id IN (SELECT id FROM shows WHERE owner_id = (SELECT auth.uid()))
  );

CREATE POLICY "members_delete_self_or_owner" ON show_members
  FOR DELETE USING (
    user_id = (SELECT auth.uid())
    OR show_id IN (SELECT id FROM shows WHERE owner_id = (SELECT auth.uid()))
  );

-- No INSERT/UPDATE policies: joining happens inside accept_invite() below.

-- 4. Invite functions ----------------------------------------------------

-- Look up an invite by its token for the /join page.
-- Returns exactly one row (or none), never the full table.
CREATE OR REPLACE FUNCTION get_invite_by_token(p_token text)
RETURNS TABLE (
  invite_id uuid,
  show_id uuid,
  show_name text,
  role text,
  email text,
  accepted boolean,
  accepted_by_me boolean,
  expired boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT i.id, i.show_id, s.name, i.role, i.email, i.accepted,
         (i.user_id IS NOT NULL AND i.user_id = auth.uid()),
         (i.expires_at IS NOT NULL AND i.expires_at < now())
  FROM show_invites i
  JOIN shows s ON s.id = i.show_id
  WHERE i.token::text = p_token
  LIMIT 1;
$$;

-- Accept an invite: validates it, creates the membership, marks it used.
-- Raises an exception with a readable message on any failure.
CREATE OR REPLACE FUNCTION accept_invite(p_token text)
RETURNS uuid  -- the show_id joined
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite show_invites%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  SELECT * INTO v_invite FROM show_invites
  WHERE token::text = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;
  IF v_invite.accepted THEN
    RAISE EXCEPTION 'invite_already_used';
  END IF;
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  INSERT INTO show_members (show_id, user_id, role)
  VALUES (v_invite.show_id, v_uid, v_invite.role)
  ON CONFLICT (show_id, user_id) DO NOTHING;

  UPDATE show_invites
  SET accepted = true, user_id = v_uid
  WHERE id = v_invite.id;

  RETURN v_invite.show_id;
END;
$$;

-- Functions are callable by signed-in users; get_invite also by anon so the
-- join page can show the invite before login.
REVOKE ALL ON FUNCTION get_invite_by_token(text) FROM public;
REVOKE ALL ON FUNCTION accept_invite(text) FROM public;
GRANT EXECUTE ON FUNCTION get_invite_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION accept_invite(text) TO authenticated;
