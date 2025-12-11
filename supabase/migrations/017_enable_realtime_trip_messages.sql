-- Enable Supabase Realtime for trip_messages table
-- This is required for postgres_changes subscriptions to work

-- Set REPLICA IDENTITY to FULL for better realtime performance
ALTER TABLE trip_messages REPLICA IDENTITY FULL;

-- Add the table to the Realtime publication
-- This is required for postgres_changes to work
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND tablename = 'trip_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE trip_messages;
    END IF;
  END IF;
END $$;
