-- Migration: Add trip creators to trip_members table
-- This ensures all existing trips have their creators as members
-- Run this in Supabase SQL Editor

-- Add trip creators to trip_members if they're not already there
INSERT INTO trip_members (trip_id, user_id, role, joined_at)
SELECT 
  t.id AS trip_id,
  t.created_by AS user_id,
  'owner' AS role,
  t.created_at AS joined_at
FROM trips t
WHERE t.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = t.id
    AND tm.user_id = t.created_by
  )
ON CONFLICT (trip_id, user_id) DO NOTHING;

-- Verify the results
SELECT 
  COUNT(*) AS total_trips,
  COUNT(DISTINCT created_by) AS unique_creators,
  (SELECT COUNT(*) FROM trip_members WHERE role = 'owner') AS owners_in_members
FROM trips
WHERE created_by IS NOT NULL;

