-- Migration: Add RLS policies for trip_messages table
-- Run this in Supabase SQL Editor if trip_messages table exists but policies are missing

-- Enable RLS on trip_messages if not already enabled
ALTER TABLE trip_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view trip messages" ON trip_messages;
DROP POLICY IF EXISTS "Trip members can create messages" ON trip_messages;

-- Users can view messages in trips they're members of
CREATE POLICY "Users can view trip messages"
  ON trip_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_messages.trip_id
      AND (
        trips.created_by = auth.uid() OR
        public.is_trip_member(trips.id, auth.uid())
      )
    )
  );

-- Trip members can create messages (including AI with user_id = NULL)
CREATE POLICY "Trip members can create messages"
  ON trip_messages FOR INSERT
  WITH CHECK (
    (user_id = auth.uid() OR user_id IS NULL) AND
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_messages.trip_id
      AND (
        trips.created_by = auth.uid() OR
        public.is_trip_member(trips.id, auth.uid())
      )
    )
  );

