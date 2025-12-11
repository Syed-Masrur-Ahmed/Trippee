-- Clear all test data from Trippee tables
-- Run this in Supabase SQL Editor
-- WARNING: This will delete ALL data from these tables!

-- Delete in order to respect foreign key constraints

-- 1. Delete trip invitations
DELETE FROM trip_invitations;

-- 2. Delete trip members
DELETE FROM trip_members;

-- 3. Delete places (these reference trips)
DELETE FROM places;

-- 4. Delete trips (these reference auth.users via created_by)
DELETE FROM trips;

-- 5. Delete profiles (optional - only if you want to clear user profiles too)
-- Uncomment the line below if you want to delete profiles as well
-- DELETE FROM profiles;

-- Verify tables are empty (optional - run these to check)
-- SELECT COUNT(*) FROM trip_invitations;
-- SELECT COUNT(*) FROM trip_members;
-- SELECT COUNT(*) FROM places;
-- SELECT COUNT(*) FROM trips;
-- SELECT COUNT(*) FROM profiles;

