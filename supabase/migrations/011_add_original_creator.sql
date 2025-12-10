-- Migration: Add original_created_by field to track the original trip creator
-- This allows us to show the original creator even after ownership transfers

-- Add original_created_by column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'original_created_by'
  ) THEN
    ALTER TABLE trips ADD COLUMN original_created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    
    -- Set original_created_by to current created_by for all existing trips
    UPDATE trips SET original_created_by = created_by WHERE original_created_by IS NULL;
  END IF;
END $$;

-- Trigger function to set original_created_by when a trip is created
CREATE OR REPLACE FUNCTION public.set_original_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set original_created_by to created_by if it's not already set
  IF NEW.original_created_by IS NULL THEN
    NEW.original_created_by := NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to set original_created_by on insert
DROP TRIGGER IF EXISTS set_original_creator_trigger ON trips;
CREATE TRIGGER set_original_creator_trigger
  BEFORE INSERT ON trips
  FOR EACH ROW
  EXECUTE FUNCTION public.set_original_creator();

-- Update the handle_owner_removal function to preserve original_created_by
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
      -- But preserve original_created_by (don't change it)
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

