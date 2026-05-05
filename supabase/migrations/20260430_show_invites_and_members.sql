-- Ensure show_invites has all required columns
CREATE TABLE IF NOT EXISTS show_invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id    uuid REFERENCES shows(id) ON DELETE CASCADE,
  email      text NOT NULL,
  role       text NOT NULL,
  token      uuid DEFAULT gen_random_uuid(),
  accepted   boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE show_invites ENABLE ROW LEVEL SECURITY;

-- Show owner can create and read invites for their show
CREATE POLICY "Owner can manage show_invites" ON show_invites
  USING  (show_id IN (SELECT id FROM shows WHERE owner_id = auth.uid()))
  WITH CHECK (show_id IN (SELECT id FROM shows WHERE owner_id = auth.uid()));

-- Invited user can read their own invite (needed for the /join page)
CREATE POLICY "Invitee can read own invite" ON show_invites
  FOR SELECT
  USING (true);

-- Invited user can mark their invite accepted (needed for the /join page)
CREATE POLICY "Invitee can accept invite" ON show_invites
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Ensure show_members has required columns
ALTER TABLE show_members ADD COLUMN IF NOT EXISTS role    text;
ALTER TABLE show_members ADD COLUMN IF NOT EXISTS user_id uuid;
