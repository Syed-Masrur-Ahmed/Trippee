-- Allow all trip members to view all other trip members
-- This fixes the issue where non-host members couldn't see the host in the members list

-- Create a SECURITY DEFINER function to check membership (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_member_of_trip(trip_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = trip_uuid
    AND user_id = user_uuid
  );
$$;

-- Update trip_members SELECT policy to allow all members to see all members
DROP POLICY IF EXISTS "Users can view trip members" ON trip_members;

CREATE POLICY "Users can view trip members"
  ON trip_members FOR SELECT
  USING (
    -- Users can see their own membership
    user_id = auth.uid() OR
    -- Users can see all members if they are a member of the same trip (using SECURITY DEFINER function to avoid recursion)
    public.is_member_of_trip(trip_members.trip_id, auth.uid()) OR
    -- Trip owners can see all members
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_members.trip_id
      AND trips.created_by = auth.uid()
    )
  );

