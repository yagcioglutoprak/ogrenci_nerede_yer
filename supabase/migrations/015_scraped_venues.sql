-- ============================================================
-- 015: Scraped Venues — external data source columns & indexes
-- ============================================================
-- Adds columns to venues table to support venues imported from
-- OpenStreetMap, Overture Maps, Foursquare OS Places, and
-- on-demand Google Places enrichment.
-- ============================================================


-- ------------------------------------------
-- 1. NEW COLUMNS on venues
-- ------------------------------------------

-- Source discriminator: 'ony' = user-added, 'scraped' = imported from external sources
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'ony';

-- External IDs for deduplication & linkage
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS osm_id TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS overture_id TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS fsq_id TEXT;

-- Google Places: ID for on-demand enrichment + cached rating
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS google_place_id TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS google_rating NUMERIC(2,1);
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS google_enriched_at TIMESTAMPTZ;

-- Editorial / team curation fields
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS editorial_rating NUMERIC(3,1);
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS editorial_note TEXT;

-- Cuisine type from OSM/Foursquare data
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS cuisine TEXT;


-- ------------------------------------------
-- 2. MAKE created_by NULLABLE
-- ------------------------------------------
-- Scraped venues have no creator user. The original schema defined
-- created_by as NOT NULL. We relax that constraint here.
ALTER TABLE public.venues ALTER COLUMN created_by DROP NOT NULL;


-- ------------------------------------------
-- 3. INDEXES
-- ------------------------------------------

-- Filter by source (user-added vs scraped)
CREATE INDEX IF NOT EXISTS idx_venues_source
  ON public.venues(source);

-- Partial index on google_place_id (only non-null rows)
CREATE INDEX IF NOT EXISTS idx_venues_google_place_id
  ON public.venues(google_place_id)
  WHERE google_place_id IS NOT NULL;

-- Partial index on fsq_id (only non-null rows)
CREATE INDEX IF NOT EXISTS idx_venues_fsq_id
  ON public.venues(fsq_id)
  WHERE fsq_id IS NOT NULL;

-- NOTE: A spatial index on (latitude, longitude) already exists from
-- migration 001 as idx_venues_lat_lng. Creating a composite B-tree
-- index here as well for bounding-box style WHERE clause queries.
CREATE INDEX IF NOT EXISTS idx_venues_location
  ON public.venues(latitude, longitude);


-- ------------------------------------------
-- 4. RLS POLICIES for scraped venues
-- ------------------------------------------

-- The existing "Venues: anyone can read" policy (USING true) from
-- migration 001 already covers scraped venues for SELECT.
-- We add this explicit policy for clarity and self-documentation,
-- so that intent is clear even if the blanket policy changes later.
-- Postgres allows multiple SELECT policies — they are OR'd together.
CREATE POLICY "Scraped venues are viewable by everyone"
  ON public.venues FOR SELECT
  USING (source = 'scraped');

-- Allow authenticated users to update enrichment fields on scraped venues.
-- Without this, the enrichVenue() function using the anon key would silently
-- fail because the existing UPDATE policy requires auth.uid() = created_by,
-- which is NULL for scraped venues.
CREATE POLICY "Scraped venues: authenticated can update enrichment"
  ON public.venues FOR UPDATE
  TO authenticated
  USING (source = 'scraped')
  WITH CHECK (source = 'scraped');

-- The existing INSERT policy requires auth.uid() = created_by, which
-- won't match for scraped venues (created_by IS NULL). Scraped venues
-- are inserted via the service role key (bypasses RLS), so no
-- additional INSERT policy is needed here.


-- ------------------------------------------
-- 5. CONSTRAINTS (optional safety checks)
-- ------------------------------------------

-- Ensure source is one of the known values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'venues_source_check'
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_source_check
      CHECK (source IN ('ony', 'scraped'));
  END IF;
END
$$;

-- Ensure google_rating is within valid range (1.0 - 5.0) when present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'venues_google_rating_range'
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_google_rating_range
      CHECK (google_rating IS NULL OR (google_rating >= 1.0 AND google_rating <= 5.0));
  END IF;
END
$$;

-- Ensure editorial_rating is within valid range (1.0 - 10.0) when present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'venues_editorial_rating_range'
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_editorial_rating_range
      CHECK (editorial_rating IS NULL OR (editorial_rating >= 1.0 AND editorial_rating <= 10.0));
  END IF;
END
$$;
