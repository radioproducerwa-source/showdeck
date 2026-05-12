-- RLS for episodes, section_content, and radio_plans
-- Access = show owner (shows.owner_id) OR show member (show_members)
-- DELETE is owner-only on all three tables
-- The cron job at /api/cron/archive-episodes uses the service role key and bypasses RLS

-- ============================================================
-- episodes
-- ============================================================
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Show access: select episodes" ON episodes
  FOR SELECT USING (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = auth.uid()
      UNION
      SELECT show_id FROM show_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Show access: insert episodes" ON episodes
  FOR INSERT WITH CHECK (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = auth.uid()
      UNION
      SELECT show_id FROM show_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Show access: update episodes" ON episodes
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

CREATE POLICY "Owner only: delete episodes" ON episodes
  FOR DELETE USING (
    show_id IN (SELECT id FROM shows WHERE owner_id = auth.uid())
  );

-- ============================================================
-- section_content
-- (no direct show_id — access checked via episodes → shows)
-- ============================================================
ALTER TABLE section_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Show access: select section_content" ON section_content
  FOR SELECT USING (
    episode_id IN (
      SELECT id FROM episodes WHERE show_id IN (
        SELECT id FROM shows WHERE owner_id = auth.uid()
        UNION
        SELECT show_id FROM show_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Show access: insert section_content" ON section_content
  FOR INSERT WITH CHECK (
    episode_id IN (
      SELECT id FROM episodes WHERE show_id IN (
        SELECT id FROM shows WHERE owner_id = auth.uid()
        UNION
        SELECT show_id FROM show_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Show access: update section_content" ON section_content
  FOR UPDATE
  USING (
    episode_id IN (
      SELECT id FROM episodes WHERE show_id IN (
        SELECT id FROM shows WHERE owner_id = auth.uid()
        UNION
        SELECT show_id FROM show_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    episode_id IN (
      SELECT id FROM episodes WHERE show_id IN (
        SELECT id FROM shows WHERE owner_id = auth.uid()
        UNION
        SELECT show_id FROM show_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Owner only: delete section_content" ON section_content
  FOR DELETE USING (
    episode_id IN (
      SELECT id FROM episodes WHERE show_id IN (
        SELECT id FROM shows WHERE owner_id = auth.uid()
      )
    )
  );

-- ============================================================
-- radio_plans
-- ============================================================
ALTER TABLE radio_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Show access: select radio_plans" ON radio_plans
  FOR SELECT USING (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = auth.uid()
      UNION
      SELECT show_id FROM show_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Show access: insert radio_plans" ON radio_plans
  FOR INSERT WITH CHECK (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = auth.uid()
      UNION
      SELECT show_id FROM show_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Show access: update radio_plans" ON radio_plans
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

CREATE POLICY "Owner only: delete radio_plans" ON radio_plans
  FOR DELETE USING (
    show_id IN (SELECT id FROM shows WHERE owner_id = auth.uid())
  );
