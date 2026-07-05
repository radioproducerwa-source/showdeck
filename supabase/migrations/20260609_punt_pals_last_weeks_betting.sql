-- Add "Last Week's Betting" section to all Punt Pals episodes that are missing it
INSERT INTO sections (episode_id, name, icon, sort_order)
SELECT
  e.id,
  'Last Week''s Betting',
  '📊',
  COALESCE((SELECT MAX(sort_order) FROM sections s2 WHERE s2.episode_id = e.id), -1) + 1
FROM episodes e
WHERE e.show_id = '8265f874-9732-4b6b-8617-a6c5918c6ca7'
  AND NOT EXISTS (
    SELECT 1 FROM sections s
    WHERE s.episode_id = e.id
      AND s.name = 'Last Week''s Betting'
  );
