-- RLS policies existed on these tables but RLS itself was not enabled.
-- Enabling it makes the existing policies take effect.
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_content ENABLE ROW LEVEL SECURITY;
