-- Migration: Allow trip members to view profiles of original trip creators
-- This fixes the issue where new hosts can't see the original creator's name
-- after the original creator leaves the trip

-- Update the are_trip_members_together function to also check if the profile
-- belongs to the original creator of a trip the user is a member of
CREATE OR REPLACE FUNCTION public.are_trip_members_together(user1_uuid UUID, user2_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_members tm1
    INNER JOIN trip_members tm2 ON tm1.trip_id = tm2.trip_id
    WHERE tm1.user_id = user1_uuid
    AND tm2.user_id = user2_uuid
  ) OR EXISTS (
    -- Also allow if user1 is a member of a trip where user2 is the original creator
    SELECT 1 FROM trip_members tm
    INNER JOIN trips t ON tm.trip_id = t.id
    WHERE tm.user_id = user1_uuid
    AND (t.original_created_by = user2_uuid OR (t.original_created_by IS NULL AND t.created_by = user2_uuid))
  );
$$;

-- The profiles SELECT policy will automatically use the updated function
-- No need to recreate the policy, it will use the updated function

