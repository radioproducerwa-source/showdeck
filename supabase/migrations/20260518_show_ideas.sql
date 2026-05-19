-- Ideas board: per-show checklist items
-- Access = show owner OR show member (same pattern as all other tables)

CREATE TABLE show_ideas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id     uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  text        text NOT NULL DEFAULT '',
  done        boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE show_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Show access: select show_ideas" ON show_ideas
  FOR SELECT USING (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = auth.uid()
      UNION
      SELECT show_id FROM show_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Show access: insert show_ideas" ON show_ideas
  FOR INSERT WITH CHECK (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = auth.uid()
      UNION
      SELECT show_id FROM show_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Show access: update show_ideas" ON show_ideas
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

CREATE POLICY "Show access: delete show_ideas" ON show_ideas
  FOR DELETE USING (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = auth.uid()
      UNION
      SELECT show_id FROM show_members WHERE user_id = auth.uid()
    )
  );
