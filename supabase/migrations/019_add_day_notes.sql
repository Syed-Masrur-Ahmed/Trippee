-- Migration: Add day_number column to notes table for day-specific notes
-- This allows notes to be associated with specific days in the itinerary

-- Add day_number column
ALTER TABLE notes ADD COLUMN IF NOT EXISTS day_number INTEGER CHECK (day_number >= 1 AND day_number <= 14);

-- Drop the old unique constraint (if it exists)
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_trip_id_place_id_key;
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_trip_place_day_unique;

-- Drop old indexes if they exist
DROP INDEX IF EXISTS idx_notes_unique_general;
DROP INDEX IF EXISTS idx_notes_unique_place;
DROP INDEX IF EXISTS idx_notes_unique_day;

-- Use partial unique indexes instead of a single unique constraint
-- This properly handles NULL values in PostgreSQL

-- Unique index for general trip notes (place_id IS NULL AND day_number IS NULL)
CREATE UNIQUE INDEX idx_notes_unique_general 
  ON notes(trip_id) 
  WHERE place_id IS NULL AND day_number IS NULL;

-- Unique index for place notes (place_id IS NOT NULL AND day_number IS NULL)
CREATE UNIQUE INDEX idx_notes_unique_place 
  ON notes(trip_id, place_id) 
  WHERE place_id IS NOT NULL AND day_number IS NULL;

-- Unique index for day notes (place_id IS NULL AND day_number IS NOT NULL)
CREATE UNIQUE INDEX idx_notes_unique_day 
  ON notes(trip_id, day_number) 
  WHERE place_id IS NULL AND day_number IS NOT NULL;

-- Add check constraint to ensure notes are either for a place, a day, or general (not both place and day)
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_place_or_day_not_both;
ALTER TABLE notes ADD CONSTRAINT notes_place_or_day_not_both 
  CHECK (NOT (place_id IS NOT NULL AND day_number IS NOT NULL));

-- Create index for day_number lookups (for efficient querying)
DROP INDEX IF EXISTS idx_notes_day_number;
CREATE INDEX idx_notes_day_number ON notes(trip_id, day_number) WHERE day_number IS NOT NULL;

