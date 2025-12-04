-- Allow users to accept invitations by inserting themselves into trip_members
-- Also allow users with pending invitations to read trip information
-- Allow users to view profiles of other trip members (for chat display)
-- This fixes the RLS policy that was blocking invitation acceptance

-- Update profiles SELECT policy to allow viewing profiles of trip members
-- Use a SECURITY DEFINER helper function to avoid recursion
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
  );
$$;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id OR
    -- Allow viewing profiles of users who are members of the same trip (using SECURITY DEFINER function to avoid recursion)
    public.are_trip_members_together(auth.uid(), profiles.id)
  );

-- Update trips SELECT policy to allow reading if user has pending invitation
-- Use a SECURITY DEFINER helper function to avoid recursion
CREATE OR REPLACE FUNCTION public.has_pending_invitation(trip_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_invitations ti
    INNER JOIN profiles p ON p.email = ti.email
    WHERE ti.trip_id = trip_uuid
    AND p.id = user_uuid
    AND ti.status = 'pending'
    AND (ti.expires_at IS NULL OR ti.expires_at > NOW())
  );
$$;

DROP POLICY IF EXISTS "Users can view trips they're members of" ON trips;

CREATE POLICY "Users can view trips they're members of"
  ON trips FOR SELECT
  USING (
    created_by = auth.uid() OR
    public.is_trip_member(trips.id, auth.uid()) OR
    -- Allow reading if user has a pending invitation (using SECURITY DEFINER function to avoid recursion)
    public.has_pending_invitation(trips.id, auth.uid())
  );

-- Update trip_members INSERT policy
DROP POLICY IF EXISTS "Trip owners can add members" ON trip_members;

CREATE POLICY "Trip owners can add members"
  ON trip_members FOR INSERT
  WITH CHECK (
    -- Trip owners can add any member
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_members.trip_id
      AND trips.created_by = auth.uid()
    )
    OR
    -- Users can add themselves if they have a pending invitation
    -- Check invitation using profile email (not auth.users to avoid permission issues)
    (
      trip_members.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM trip_invitations
        INNER JOIN profiles ON profiles.email = trip_invitations.email
        WHERE trip_invitations.trip_id = trip_members.trip_id
        AND profiles.id = auth.uid()
        AND trip_invitations.status = 'pending'
        AND (trip_invitations.expires_at IS NULL OR trip_invitations.expires_at > NOW())
      )
    )
  );

