-- Migration: Clean up duplicate notes and ensure unique constraint
-- This fixes the issue where multiple notes were created for the same trip/place combination

-- First, keep only the most recently updated note for each trip/place combination
-- and delete the duplicates
WITH ranked_notes AS (
  SELECT 
    id,
    trip_id,
    place_id,
    ROW_NUMBER() OVER (
      PARTITION BY trip_id, COALESCE(place_id::text, 'null') 
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    ) as rn
  FROM notes
)
DELETE FROM notes
WHERE id IN (
  SELECT id FROM ranked_notes WHERE rn > 1
);

-- Drop the existing unique constraint if it exists (may have failed before)
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_trip_id_place_id_key;

-- Create a unique index that properly handles NULL values for place_id
-- This replaces the unique constraint since PostgreSQL unique constraints 
-- treat NULL as distinct values
CREATE UNIQUE INDEX IF NOT EXISTS notes_trip_place_unique 
ON notes (trip_id, COALESCE(place_id, '00000000-0000-0000-0000-000000000000'));

