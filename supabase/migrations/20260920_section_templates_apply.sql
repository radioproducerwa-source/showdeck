-- ============================================================
-- section_templates — actually applied to production.
--
-- 20260427_section_templates.sql was written but never run against
-- production, so the table did not exist there: "Save as template" in
-- the planner silently failed, and the episode bootstrap's first
-- choice (template → previous episode → show_type defaults) always
-- errored and fell through to the previous episode.
--
-- This file supersedes it. Two deliberate differences from the
-- original, since there is no existing data to preserve:
--   * modern RLS style — one policy per verb, (SELECT auth.uid())
--   * SELECT is owner-OR-member. The planner reads this table on every
--     episode load, including for co-hosts, so an owner-only read
--     policy would have left members with no template at all.
--     Writes stay owner-only.
--
-- 20260427_section_templates.sql stays on disk as history.
-- ============================================================

CREATE TABLE IF NOT EXISTS section_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id     uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  name        text NOT NULL,
  icon        text,
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE section_templates ENABLE ROW LEVEL SECURITY;

-- Drop every policy on the table before recreating — never layer new
-- policies over old ones (see the RLS note in CLAUDE.md).
DROP POLICY IF EXISTS "Owner can manage section_templates" ON section_templates;
DROP POLICY IF EXISTS section_templates_select ON section_templates;
DROP POLICY IF EXISTS section_templates_insert ON section_templates;
DROP POLICY IF EXISTS section_templates_update ON section_templates;
DROP POLICY IF EXISTS section_templates_delete ON section_templates;

-- Read: owner OR member — the planner loads templates for co-hosts too
CREATE POLICY section_templates_select ON section_templates
  FOR SELECT USING (
    show_id IN (
      SELECT id FROM shows WHERE owner_id = (SELECT auth.uid())
      UNION
      SELECT show_id FROM show_members WHERE user_id = (SELECT auth.uid())
    )
  );

-- Manage: owner only
CREATE POLICY section_templates_insert ON section_templates
  FOR INSERT WITH CHECK (
    show_id IN (SELECT id FROM shows WHERE owner_id = (SELECT auth.uid()))
  );

CREATE POLICY section_templates_update ON section_templates
  FOR UPDATE USING (
    show_id IN (SELECT id FROM shows WHERE owner_id = (SELECT auth.uid()))
  ) WITH CHECK (
    show_id IN (SELECT id FROM shows WHERE owner_id = (SELECT auth.uid()))
  );

CREATE POLICY section_templates_delete ON section_templates
  FOR DELETE USING (
    show_id IN (SELECT id FROM shows WHERE owner_id = (SELECT auth.uid()))
  );
