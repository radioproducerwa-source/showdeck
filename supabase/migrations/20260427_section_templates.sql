CREATE TABLE IF NOT EXISTS section_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id     UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  icon        TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE section_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage section_templates" ON section_templates
  USING  (show_id IN (SELECT id FROM shows WHERE owner_id = auth.uid()))
  WITH CHECK (show_id IN (SELECT id FROM shows WHERE owner_id = auth.uid()));
