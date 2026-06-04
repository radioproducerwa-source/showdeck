-- Ensure radio_plans has a unique constraint required for upsert onConflict
-- Safe to run even if the constraint already exists

CREATE UNIQUE INDEX IF NOT EXISTS radio_plans_show_date_hour_slot_key
  ON radio_plans (show_id, plan_date, hour, slot_key);
