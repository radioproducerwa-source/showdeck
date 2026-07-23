-- ============================================================
-- RLS reset for episodes + section_content
--
-- Production had policies that predate the 20260512 migration and
-- RLS toggled off. This migration nukes ALL existing policies on
-- both tables and recreates the canonical set, then enables RLS.
--
-- Access model (same as the rest of the schema):
--   read/write  = show owner OR show member
--   delete      = show owner only
--   section_content has no show_id — access goes via episodes → shows
--
-- auth.uid() is wrapped in (SELECT auth.uid()) so Postgres evaluates
-- it once per query instead of once per row.
--
-- ROLLBACK (instant, if anything looks wrong afterwards):
--   ALTER TABLE public.episodes        DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.section_content DISABLE ROW LEVEL SECURITY;
-- ============================================================

-- 1. Drop every existing policy on both tables, whatever it's called
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('episodes', 'section_content')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 2. episodes ------------------------------------------------

CREATE POLICY "episodes_select" ON public.episodes
  FOR SELECT USING (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = (SELECT auth.uid())
      UNION
      SELECT show_id FROM show_members WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "episodes_insert" ON public.episodes
  FOR INSERT WITH CHECK (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = (SELECT auth.uid())
      UNION
      SELECT show_id FROM show_members WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "episodes_update" ON public.episodes
  FOR UPDATE
  USING (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = (SELECT auth.uid())
      UNION
      SELECT show_id FROM show_members WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = (SELECT auth.uid())
      UNION
      SELECT show_id FROM show_members WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "episodes_delete_owner" ON public.episodes
  FOR DELETE USING (
    show_id IN (SELECT id FROM shows WHERE owner_id = (SELECT auth.uid()))
  );

-- 3. section_content ----------------------------------------

CREATE POLICY "section_content_select" ON public.section_content
  FOR SELECT USING (
    episode_id IN (
      SELECT id FROM episodes WHERE show_id IN (
        SELECT id FROM shows WHERE owner_id = (SELECT auth.uid())
        UNION
        SELECT show_id FROM show_members WHERE user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "section_content_insert" ON public.section_content
  FOR INSERT WITH CHECK (
    episode_id IN (
      SELECT id FROM episodes WHERE show_id IN (
        SELECT id FROM shows WHERE owner_id = (SELECT auth.uid())
        UNION
        SELECT show_id FROM show_members WHERE user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "section_content_update" ON public.section_content
  FOR UPDATE
  USING (
    episode_id IN (
      SELECT id FROM episodes WHERE show_id IN (
        SELECT id FROM shows WHERE owner_id = (SELECT auth.uid())
        UNION
        SELECT show_id FROM show_members WHERE user_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    episode_id IN (
      SELECT id FROM episodes WHERE show_id IN (
        SELECT id FROM shows WHERE owner_id = (SELECT auth.uid())
        UNION
        SELECT show_id FROM show_members WHERE user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "section_content_delete_owner" ON public.section_content
  FOR DELETE USING (
    episode_id IN (
      SELECT id FROM episodes WHERE show_id IN (
        SELECT id FROM shows WHERE owner_id = (SELECT auth.uid())
      )
    )
  );

-- 4. Turn RLS on — policies above take effect from this moment
ALTER TABLE public.episodes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_content ENABLE ROW LEVEL SECURITY;
