-- Migration: Create notes table for collaborative trip notes
-- This enables real-time collaborative note editing for trips and places

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  content JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure one note per place per trip (or one general note per trip if place_id is null)
  UNIQUE(trip_id, place_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notes_trip_id ON notes(trip_id);
CREATE INDEX IF NOT EXISTS idx_notes_place_id ON notes(place_id);
CREATE INDEX IF NOT EXISTS idx_notes_trip_place ON notes(trip_id, place_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS notes_updated_at_trigger ON notes;
CREATE TRIGGER notes_updated_at_trigger
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_notes_updated_at();

-- Enable Row Level Security
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Trip members can view notes" ON notes;
DROP POLICY IF EXISTS "Trip members can create notes" ON notes;
DROP POLICY IF EXISTS "Trip members can update notes" ON notes;

-- RLS Policy: Trip members can view notes
-- Use existing is_trip_member function and also check if user is trip owner
CREATE POLICY "Trip members can view notes"
  ON notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = notes.trip_id
      AND trips.created_by = auth.uid()
    ) OR
    public.is_trip_member(notes.trip_id, auth.uid())
  );

-- RLS Policy: Trip members can create notes
CREATE POLICY "Trip members can create notes"
  ON notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = notes.trip_id
      AND trips.created_by = auth.uid()
    ) OR
    public.is_trip_member(notes.trip_id, auth.uid())
  );

-- RLS Policy: Trip members can update notes
CREATE POLICY "Trip members can update notes"
  ON notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = notes.trip_id
      AND trips.created_by = auth.uid()
    ) OR
    public.is_trip_member(notes.trip_id, auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = notes.trip_id
      AND trips.created_by = auth.uid()
    ) OR
    public.is_trip_member(notes.trip_id, auth.uid())
  );

