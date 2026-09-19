-- ============================================================
-- Per-show pinned sections.
--
-- A pinned section auto-inserts into every episode of the show and
-- can't be removed in the planner. `import_from` lists the section
-- names whose notes are aggregated into it from the previous episode
-- (empty = no import button).
--
-- This replaces the hardcoded Punt Pals rules that used to live in
-- app/planner/[showId]/page.tsx.
-- ============================================================

CREATE TABLE IF NOT EXISTS show_pinned_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id     uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  name        text NOT NULL,
  icon        text NOT NULL DEFAULT '📝',
  order_index integer NOT NULL DEFAULT 0,
  import_from text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (show_id, name)
);

ALTER TABLE show_pinned_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pinned_sections_select ON show_pinned_sections;
DROP POLICY IF EXISTS pinned_sections_insert ON show_pinned_sections;
DROP POLICY IF EXISTS pinned_sections_update ON show_pinned_sections;
DROP POLICY IF EXISTS pinned_sections_delete ON show_pinned_sections;

-- Read: owner OR member — the planner applies the rules for co-hosts too
CREATE POLICY pinned_sections_select ON show_pinned_sections
  FOR SELECT USING (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = (SELECT auth.uid())
      UNION
      SELECT show_id FROM show_members WHERE user_id = (SELECT auth.uid())
    )
  );

-- Manage: owner only (Show Settings is already owner-gated)
CREATE POLICY pinned_sections_insert ON show_pinned_sections
  FOR INSERT WITH CHECK (
    show_id IN (SELECT id FROM shows WHERE owner_id = (SELECT auth.uid()))
  );

CREATE POLICY pinned_sections_update ON show_pinned_sections
  FOR UPDATE USING (
    show_id IN (SELECT id FROM shows WHERE owner_id = (SELECT auth.uid()))
  ) WITH CHECK (
    show_id IN (SELECT id FROM shows WHERE owner_id = (SELECT auth.uid()))
  );

CREATE POLICY pinned_sections_delete ON show_pinned_sections
  FOR DELETE USING (
    show_id IN (SELECT id FROM shows WHERE owner_id = (SELECT auth.uid()))
  );

-- ── Seed: Punt Pals, preserving the behaviour the hardcoding gave it ──
-- Icons are read back from the show's existing section rows so the seed
-- can't introduce a mismatched icon; '📊' is the fallback.
-- The `FROM shows` join makes this a silent no-op on a database without
-- that show, and ON CONFLICT makes the whole file safe to re-run.
INSERT INTO show_pinned_sections (show_id, name, icon, order_index, import_from)
SELECT
  s.id,
  v.name,
  COALESCE((
    SELECT sec.icon
    FROM sections sec
    JOIN episodes e ON e.id = sec.episode_id
    WHERE e.show_id = s.id AND sec.name = v.name AND sec.icon IS NOT NULL
    LIMIT 1
  ), '📊'),
  v.order_index,
  v.import_from
FROM shows s
CROSS JOIN (VALUES
  ('AFL Multis',           0, '{}'::text[]),
  ('Racing Bets',          1, '{}'::text[]),
  ('Last Week''s Betting', 2, ARRAY['AFL Multis', 'Racing Bets'])
) AS v(name, order_index, import_from)
WHERE s.id = '8265f874-9732-4b6b-8617-a6c5918c6ca7'
ON CONFLICT (show_id, name) DO NOTHING;
