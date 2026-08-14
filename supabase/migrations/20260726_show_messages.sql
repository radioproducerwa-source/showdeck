-- ============================================================
-- Per-show live chat (Supabase Realtime)
-- Owner + members can read and post; sender name/avatar are
-- denormalised onto the row so realtime messages render without
-- a cross-user profile lookup.
-- ============================================================

CREATE TABLE IF NOT EXISTS show_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  sender_name text,
  sender_avatar text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS show_messages_show_created_idx
  ON show_messages (show_id, created_at);

ALTER TABLE show_messages ENABLE ROW LEVEL SECURITY;

-- Read: owner or member of the show
CREATE POLICY "messages_select" ON show_messages
  FOR SELECT USING (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = (SELECT auth.uid())
      UNION
      SELECT show_id FROM show_members WHERE user_id = (SELECT auth.uid())
    )
  );

-- Post: must be yourself, and owner or member of the show
CREATE POLICY "messages_insert" ON show_messages
  FOR INSERT WITH CHECK (
    user_id = (SELECT auth.uid())
    AND show_id IN (
      SELECT id FROM shows WHERE owner_id = (SELECT auth.uid())
      UNION
      SELECT show_id FROM show_members WHERE user_id = (SELECT auth.uid())
    )
  );

-- Delete: your own message, or the show owner can remove any
CREATE POLICY "messages_delete_own_or_owner" ON show_messages
  FOR DELETE USING (
    user_id = (SELECT auth.uid())
    OR show_id IN (SELECT id FROM shows WHERE owner_id = (SELECT auth.uid()))
  );

-- Broadcast inserts over Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE show_messages;
