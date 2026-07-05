-- Add "Launching Towards the GF Challenge" section to all Punt Pals episodes missing it
INSERT INTO sections (episode_id, name, icon, sort_order)
SELECT
  e.id,
  'Launching Towards the GF Challenge',
  '🏆',
  COALESCE((SELECT MAX(sort_order) FROM sections s2 WHERE s2.episode_id = e.id), -1) + 1
FROM episodes e
WHERE e.show_id = '8265f874-9732-4b6b-8617-a6c5918c6ca7'
  AND NOT EXISTS (
    SELECT 1 FROM sections s
    WHERE s.episode_id = e.id
      AND s.name = 'Launching Towards the GF Challenge'
  );
