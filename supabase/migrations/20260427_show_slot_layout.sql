CREATE TABLE IF NOT EXISTS show_slot_layout (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id      UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  slot_key     TEXT NOT NULL,
  label        TEXT NOT NULL,
  slot_time    TEXT,
  is_fixed     BOOLEAN NOT NULL DEFAULT false,
  is_interview BOOLEAN NOT NULL DEFAULT false,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (show_id, slot_key)
);

ALTER TABLE show_slot_layout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage show_slot_layout" ON show_slot_layout
  USING  (show_id IN (SELECT id FROM shows WHERE owner_id = auth.uid()))
  WITH CHECK (show_id IN (SELECT id FROM shows WHERE owner_id = auth.uid()));
