-- Remove the get_user_email function that was causing "permission denied for table users" errors
-- This function was created in migration 005 but causes issues because regular users can't access auth.users

-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.get_user_email(UUID);

-- Revert the trips SELECT policy to not use the function
DROP POLICY IF EXISTS "Users can view trips they're members of" ON trips;

CREATE POLICY "Users can view trips they're members of"
  ON trips FOR SELECT
  USING (
    created_by = auth.uid() OR
    public.is_trip_member(trips.id, auth.uid())
  );

