-- Track which user accepted each invite (enables revoke)
ALTER TABLE show_invites ADD COLUMN IF NOT EXISTS user_id uuid;

-- RLS for show_members
ALTER TABLE show_members ENABLE ROW LEVEL SECURITY;

-- Owner can fully manage membership for their shows
CREATE POLICY "Owner can manage show_members" ON show_members
  USING  (show_id IN (SELECT id FROM shows WHERE owner_id = auth.uid()))
  WITH CHECK (show_id IN (SELECT id FROM shows WHERE owner_id = auth.uid()));

-- Members can read their own rows (needed for dashboard)
CREATE POLICY "Member can read own membership" ON show_members
  FOR SELECT USING (user_id = auth.uid());

-- Members can insert themselves on invite acceptance
CREATE POLICY "Member can join via invite" ON show_members
  FOR INSERT WITH CHECK (user_id = auth.uid());
