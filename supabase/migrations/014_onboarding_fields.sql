-- Add onboarding-related columns to users table
-- Reuses existing `university` column for school name
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_lat DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_lng DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS food_preferences TEXT[] DEFAULT '{}';
