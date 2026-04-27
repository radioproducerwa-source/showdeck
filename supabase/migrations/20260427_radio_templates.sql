CREATE TABLE IF NOT EXISTS radio_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id      UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  day_of_week  TEXT NOT NULL,
  slot_time    TEXT NOT NULL,
  hour         INTEGER NOT NULL,
  slot_type    TEXT,
  title        TEXT,
  notes        TEXT,
  is_fixed     BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE radio_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage radio_templates" ON radio_templates
  USING  (show_id IN (SELECT id FROM shows WHERE owner_id = auth.uid()))
  WITH CHECK (show_id IN (SELECT id FROM shows WHERE owner_id = auth.uid()));
