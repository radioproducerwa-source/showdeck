-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New Query)

-- 1. show_invites table
CREATE TABLE IF NOT EXISTS show_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid REFERENCES shows(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL,
  token uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  accepted boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

-- 2. Ensure show_members has the required columns
ALTER TABLE show_members ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE show_members ADD COLUMN IF NOT EXISTS user_id uuid;

-- Unique constraint to prevent duplicate memberships
CREATE UNIQUE INDEX IF NOT EXISTS show_members_show_user_idx
  ON show_members(show_id, user_id);

-- 3. (Optional) RLS policies — run if your tables have RLS enabled
-- Allow authenticated users to read invites by token (for join page)
-- CREATE POLICY "read invite by token" ON show_invites
--   FOR SELECT USING (true);
-- Allow anon to read invites by token
-- ALTER TABLE show_invites ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "anon read show_invites" ON show_invites
--   FOR SELECT TO anon USING (true);
-- CREATE POLICY "auth read show_invites" ON show_invites
--   FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "auth insert show_invites" ON show_invites
--   FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "auth update show_invites" ON show_invites
--   FOR UPDATE TO authenticated USING (true);
-- CREATE POLICY "auth insert show_members" ON show_members
--   FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "auth select show_members" ON show_members
--   FOR SELECT TO authenticated USING (true);
