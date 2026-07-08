-- Allow shows to set a starting episode number so legacy shows can reflect their true episode count
ALTER TABLE shows ADD COLUMN IF NOT EXISTS episode_number_start integer DEFAULT 1;
