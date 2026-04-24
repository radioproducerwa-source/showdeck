-- Mark episodes as archived so they no longer appear as "current"
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
