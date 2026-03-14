-- ============================================================
-- 016: Enrichment cache — store full Google Places data permanently
-- ============================================================

-- Additional Google Places enrichment fields for permanent caching
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS google_photos TEXT[];
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS google_phone TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS google_website TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS google_hours TEXT[];
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS google_price_level TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS google_rating_count INTEGER;
