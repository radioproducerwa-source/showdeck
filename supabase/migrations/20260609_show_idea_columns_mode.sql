-- Add weekly auto-clear mode to idea columns
ALTER TABLE show_idea_columns ADD COLUMN IF NOT EXISTS mode text DEFAULT 'permanent';
ALTER TABLE show_idea_columns ADD COLUMN IF NOT EXISTS last_cleared_week text;
