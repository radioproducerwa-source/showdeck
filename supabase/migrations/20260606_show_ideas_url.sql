-- Add optional URL field to show_ideas
ALTER TABLE show_ideas ADD COLUMN IF NOT EXISTS url text;
