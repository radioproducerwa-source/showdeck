CREATE TABLE IF NOT EXISTS recurring_segments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id    UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE recurring_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage recurring_segments" ON recurring_segments
  USING  (show_id IN (SELECT id FROM shows WHERE owner_id = auth.uid()))
  WITH CHECK (show_id IN (SELECT id FROM shows WHERE owner_id = auth.uid()));
