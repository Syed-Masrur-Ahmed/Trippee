-- Migration: Add start_date and end_date columns to trips table
-- Run this in Supabase SQL Editor

-- Add start_date column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE trips ADD COLUMN start_date DATE;
  END IF;
END $$;

-- Add end_date column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE trips ADD COLUMN end_date DATE;
  END IF;
END $$;

-- Ensure trip_days column exists (it should already exist from initial schema)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trips' AND column_name = 'trip_days'
  ) THEN
    ALTER TABLE trips ADD COLUMN trip_days INTEGER DEFAULT 3 CHECK (trip_days > 0 AND trip_days <= 14);
  END IF;
END $$;

-- Add check constraint to ensure end_date is after start_date (if both are set)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'trips_dates_check' AND table_name = 'trips'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_dates_check 
      CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);
  END IF;
END $$;

