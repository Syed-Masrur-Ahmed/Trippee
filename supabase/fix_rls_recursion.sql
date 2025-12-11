-- Fix infinite recursion in RLS policies
-- Run this in Supabase SQL Editor
-- 
-- The issue: trips policy checks trip_members, trip_members policy checks trips = infinite loop
-- Solution: Use SECURITY DEFINER function to bypass RLS for the check

-- Create a helper function that bypasses RLS to check membership
CREATE OR REPLACE FUNCTION public.is_trip_member(trip_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = trip_uuid
    AND user_id = user_uuid
  );
$$;

-- Fix trips policy (use the helper function to avoid recursion)
DROP POLICY IF EXISTS "Users can view trips they're members of" ON trips;

CREATE POLICY "Users can view trips they're members of"
  ON trips FOR SELECT
  USING (
    created_by = auth.uid() OR
    public.is_trip_member(trips.id, auth.uid())
  );

-- Fix trip_members policy (check trips directly, but only for ownership - no recursion)
DROP POLICY IF EXISTS "Users can view trip members" ON trip_members;

CREATE POLICY "Users can view trip members"
  ON trip_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_members.trip_id
      AND trips.created_by = auth.uid()
    )
  );

