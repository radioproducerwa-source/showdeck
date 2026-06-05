-- Add optional notes field to show_ideas
ALTER TABLE show_ideas ADD COLUMN IF NOT EXISTS notes text;
