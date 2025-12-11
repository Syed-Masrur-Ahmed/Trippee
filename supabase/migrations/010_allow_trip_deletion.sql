-- Migration: Allow users to remove themselves from trips
-- If owner leaves, transfer ownership to oldest member
-- If owner is the only member, delete the trip

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Trip owners can delete trips" ON trips;
DROP POLICY IF EXISTS "Users can remove themselves from trips" ON trip_members;

-- Function to handle ownership transfer when owner leaves
CREATE OR REPLACE FUNCTION public.handle_owner_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  remaining_members_count INTEGER;
  new_owner_id UUID;
  is_owner BOOLEAN;
BEGIN
  -- Check if the removed user was the owner
  SELECT EXISTS (
    SELECT 1 FROM trips
    WHERE trips.id = OLD.trip_id
    AND trips.created_by = OLD.user_id
  ) INTO is_owner;

  IF is_owner THEN
    -- Count remaining members
    SELECT COUNT(*) INTO remaining_members_count
    FROM trip_members
    WHERE trip_id = OLD.trip_id;

    IF remaining_members_count = 0 THEN
      -- No remaining members, delete the trip
      DELETE FROM trips WHERE id = OLD.trip_id;
    ELSE
      -- Find the oldest member (by joined_at) to become the new owner
      SELECT user_id INTO new_owner_id
      FROM trip_members
      WHERE trip_id = OLD.trip_id
      ORDER BY joined_at ASC
      LIMIT 1;

      -- Update the trip's created_by to the new owner
      UPDATE trips
      SET created_by = new_owner_id
      WHERE id = OLD.trip_id;

      -- Update the new owner's role in trip_members
      UPDATE trip_members
      SET role = 'owner'
      WHERE trip_id = OLD.trip_id
      AND user_id = new_owner_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

-- Create trigger to handle ownership transfer
DROP TRIGGER IF EXISTS handle_owner_removal_trigger ON trip_members;
CREATE TRIGGER handle_owner_removal_trigger
  AFTER DELETE ON trip_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_owner_removal();

-- Allow users to remove themselves from trips
CREATE POLICY "Users can remove themselves from trips"
  ON trip_members FOR DELETE
  USING (user_id = auth.uid());

-- Trip owners can still delete trips (if they're the only member)
CREATE POLICY "Trip owners can delete trips"
  ON trips FOR DELETE
  USING (created_by = auth.uid());

