-- Migration: Add Authentication & User Management Tables
-- Run this in Supabase SQL Editor

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Update trips table to add created_by if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE trips ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE trips ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Trip members (for collaboration)
CREATE TABLE IF NOT EXISTS trip_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);

-- Update places table created_by to be UUID if it's currently TEXT
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'places' AND column_name = 'created_by' 
    AND data_type = 'text'
  ) THEN
    -- Convert existing text created_by to UUID (set to NULL for now, will be updated by app)
    ALTER TABLE places ALTER COLUMN created_by TYPE UUID USING NULL;
    ALTER TABLE places ALTER COLUMN created_by SET DEFAULT NULL;
    ALTER TABLE places ADD CONSTRAINT places_created_by_fkey 
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'places' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE places ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Trip invitations table
CREATE TABLE IF NOT EXISTS trip_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON trip_members(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_created_by ON trips(created_by);
CREATE INDEX IF NOT EXISTS idx_trip_invitations_token ON trip_invitations(token);
CREATE INDEX IF NOT EXISTS idx_trip_invitations_email ON trip_invitations(email);

-- Row Level Security Policies for trips
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view trips they're members of" ON trips;
DROP POLICY IF EXISTS "Users can create trips" ON trips;
DROP POLICY IF EXISTS "Trip owners can update trips" ON trips;

-- Helper function to check trip membership (bypasses RLS to avoid recursion)
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

-- Trips: Users can read trips they're members of
CREATE POLICY "Users can view trips they're members of"
  ON trips FOR SELECT
  USING (
    created_by = auth.uid() OR
    public.is_trip_member(trips.id, auth.uid())
  );

-- Trips: Users can create trips
CREATE POLICY "Users can create trips"
  ON trips FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Trips: Owners can update their trips
CREATE POLICY "Trip owners can update trips"
  ON trips FOR UPDATE
  USING (created_by = auth.uid());

-- Row Level Security Policies for trip_members
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view trip members" ON trip_members;
DROP POLICY IF EXISTS "Trip owners can add members" ON trip_members;

-- Trip members: Users can view members of trips they're in
-- Fixed: Check if user is owner of the trip or is a member (avoid recursion)
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

-- Trip members: Trip owners can add members
CREATE POLICY "Trip owners can add members"
  ON trip_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_members.trip_id
      AND trips.created_by = auth.uid()
    )
  );

-- Row Level Security Policies for places
ALTER TABLE places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view places in their trips" ON places;
DROP POLICY IF EXISTS "Trip members can create places" ON places;
DROP POLICY IF EXISTS "Trip members can update places" ON places;
DROP POLICY IF EXISTS "Trip members can delete places" ON places;

-- Places: Users can read places in trips they're members of
CREATE POLICY "Users can view places in their trips"
  ON places FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = places.trip_id
      AND (
        trips.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM trip_members
          WHERE trip_members.trip_id = trips.id
          AND trip_members.user_id = auth.uid()
        )
      )
    )
  );

-- Places: Trip members can create places
CREATE POLICY "Trip members can create places"
  ON places FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = places.trip_id
      AND (
        trips.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM trip_members
          WHERE trip_members.trip_id = trips.id
          AND trip_members.user_id = auth.uid()
        )
      )
    )
  );

-- Places: Trip members can update places
CREATE POLICY "Trip members can update places"
  ON places FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = places.trip_id
      AND (
        trips.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM trip_members
          WHERE trip_members.trip_id = trips.id
          AND trip_members.user_id = auth.uid()
        )
      )
    )
  );

-- Places: Trip members can delete places
CREATE POLICY "Trip members can delete places"
  ON places FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = places.trip_id
      AND (
        trips.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM trip_members
          WHERE trip_members.trip_id = trips.id
          AND trip_members.user_id = auth.uid()
        )
      )
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trips_updated_at ON trips;
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

