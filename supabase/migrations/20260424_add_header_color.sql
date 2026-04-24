-- Add header_color column to shows table for per-show banner colour
ALTER TABLE shows ADD COLUMN IF NOT EXISTS header_color TEXT DEFAULT '#00e5a0';

-- Add sort_order to sections for drag-to-reorder in podcast planner
ALTER TABLE sections ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
