-- Create section_links table with full RLS
-- (access checked via episode_id → episodes → shows, same pattern as section_content)

CREATE TABLE IF NOT EXISTS section_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  section_name text NOT NULL,
  url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE section_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Show access: select section_links" ON section_links;
DROP POLICY IF EXISTS "Show access: insert section_links" ON section_links;
DROP POLICY IF EXISTS "Show access: delete section_links" ON section_links;

CREATE POLICY "Show access: select section_links" ON section_links
  FOR SELECT USING (
    episode_id IN (
      SELECT id FROM episodes WHERE show_id IN (
        SELECT id FROM shows WHERE owner_id = auth.uid()
        UNION
        SELECT show_id FROM show_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Show access: insert section_links" ON section_links
  FOR INSERT WITH CHECK (
    episode_id IN (
      SELECT id FROM episodes WHERE show_id IN (
        SELECT id FROM shows WHERE owner_id = auth.uid()
        UNION
        SELECT show_id FROM show_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Show access: delete section_links" ON section_links
  FOR DELETE USING (
    episode_id IN (
      SELECT id FROM episodes WHERE show_id IN (
        SELECT id FROM shows WHERE owner_id = auth.uid()
        UNION
        SELECT show_id FROM show_members WHERE user_id = auth.uid()
      )
    )
  );
