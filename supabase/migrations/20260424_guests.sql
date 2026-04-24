-- Guest address book, scoped per show
CREATE TABLE IF NOT EXISTS guests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id     UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  title       TEXT,
  phone       TEXT,
  email       TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage guests" ON guests
  USING  (show_id IN (SELECT id FROM shows WHERE owner_id = auth.uid()))
  WITH CHECK (show_id IN (SELECT id FROM shows WHERE owner_id = auth.uid()));
