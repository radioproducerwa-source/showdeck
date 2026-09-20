-- ============================================================
-- Remove the Grand Final section from Punt Pals entirely.
--
-- It was seeded by 20260609_punt_pals_gf_challenge.sql as
-- "Launching Towards the GF Challenge" and has since been referred to
-- as "Road to Grand Final" — it may have been renamed in the planner,
-- so both exact names are targeted. It has no code behind it, so this
-- is pure data cleanup.
--
-- When this was applied, the `sections` rows had already been deleted by
-- hand, so in practice it only swept up orphaned children.
--
-- Children go first: section_content and section_links are keyed by
-- section NAME, not by the sections row id, so deleting the sections
-- row alone would leave them orphaned (and they'd resurface if a
-- section with the same name were ever re-added).
--
-- Before running, confirm the live name and how much content is at
-- stake — this is destructive and there is no undo:
--
--   SELECT s.name, count(*) AS sections
--   FROM sections s JOIN episodes e ON e.id = s.episode_id
--   WHERE e.show_id = '8265f874-9732-4b6b-8617-a6c5918c6ca7'
--   GROUP BY s.name ORDER BY s.name;
--
--   SELECT sc.section_name, count(*) FILTER (WHERE coalesce(sc.content,'') <> '') AS with_notes
--   FROM section_content sc JOIN episodes e ON e.id = sc.episode_id
--   WHERE e.show_id = '8265f874-9732-4b6b-8617-a6c5918c6ca7'
--     AND sc.section_name IN ('Launching Towards the GF Challenge', 'Road to Grand Final')
--   GROUP BY sc.section_name;
-- ============================================================

DELETE FROM section_content
WHERE section_name IN ('Launching Towards the GF Challenge', 'Road to Grand Final')
  AND episode_id IN (
    SELECT id FROM episodes WHERE show_id = '8265f874-9732-4b6b-8617-a6c5918c6ca7'
  );

DELETE FROM section_links
WHERE section_name IN ('Launching Towards the GF Challenge', 'Road to Grand Final')
  AND episode_id IN (
    SELECT id FROM episodes WHERE show_id = '8265f874-9732-4b6b-8617-a6c5918c6ca7'
  );

DELETE FROM sections
WHERE name IN ('Launching Towards the GF Challenge', 'Road to Grand Final')
  AND episode_id IN (
    SELECT id FROM episodes WHERE show_id = '8265f874-9732-4b6b-8617-a6c5918c6ca7'
  );

-- NOTE: there was a fourth statement here clearing the name out of
-- section_templates. It was dropped because that table did not exist in
-- production when this ran (see 20260920_section_templates_apply.sql) —
-- so there was nothing to clear, and the reference aborted the whole
-- transaction. If you re-run this file against a database that predates
-- that fix, add it back.
