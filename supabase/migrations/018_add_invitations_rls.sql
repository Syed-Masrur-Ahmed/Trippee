-- Enable RLS on trip_invitations if not already enabled
ALTER TABLE trip_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Trip owners can create invitations" ON trip_invitations;
DROP POLICY IF EXISTS "Trip members can create invitations" ON trip_invitations;
DROP POLICY IF EXISTS "Users can view invitations sent to their email" ON trip_invitations;
DROP POLICY IF EXISTS "Users can update invitations sent to their email" ON trip_invitations;
DROP POLICY IF EXISTS "Trip owners can view their invitations" ON trip_invitations;

-- Allow trip owners and members to create invitations
-- Uses the same pattern as trip_messages table
CREATE POLICY "Trip members can create invitations"
  ON trip_invitations FOR INSERT
  WITH CHECK (
    -- User must be the one creating the invitation
    invited_by = auth.uid()
    AND
    -- User must be trip owner or member
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_invitations.trip_id
      AND (
        trips.created_by = auth.uid() OR
        public.is_trip_member(trips.id, auth.uid())
      )
    )
  );

-- Allow trip owners to view invitations they sent (for managing invites)
CREATE POLICY "Trip owners can view their invitations"
  ON trip_invitations FOR SELECT
  USING (
    invited_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_invitations.trip_id
      AND trips.created_by = auth.uid()
    )
  );

-- Allow users to view invitations sent to their email
-- This matches invitations by comparing the user's profile email with the invitation email
CREATE POLICY "Users can view invitations sent to their email"
  ON trip_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = trip_invitations.email
    )
  );

-- Allow users to update their own invitations (to accept/decline)
CREATE POLICY "Users can update invitations sent to their email"
  ON trip_invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = trip_invitations.email
    )
  );

