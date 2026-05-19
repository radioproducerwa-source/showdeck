-- Column definitions for the Ideas Board
-- Each show can have multiple named columns (e.g. Phoners, Tactics)
-- Default columns are created by the app on first visit

CREATE TABLE show_idea_columns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id     uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'Column',
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE show_idea_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Show access: select show_idea_columns" ON show_idea_columns
  FOR SELECT USING (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = auth.uid()
      UNION
      SELECT show_id FROM show_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Show access: insert show_idea_columns" ON show_idea_columns
  FOR INSERT WITH CHECK (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = auth.uid()
      UNION
      SELECT show_id FROM show_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Show access: update show_idea_columns" ON show_idea_columns
  FOR UPDATE
  USING (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = auth.uid()
      UNION
      SELECT show_id FROM show_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = auth.uid()
      UNION
      SELECT show_id FROM show_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Show access: delete show_idea_columns" ON show_idea_columns
  FOR DELETE USING (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = auth.uid()
      UNION
      SELECT show_id FROM show_members WHERE user_id = auth.uid()
    )
  );

-- Link existing ideas to a column
ALTER TABLE show_ideas ADD COLUMN column_id uuid REFERENCES show_idea_columns(id) ON DELETE CASCADE;
