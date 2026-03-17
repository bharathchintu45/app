-- Add saved_addresses and default_delivery columns to profiles table
-- Run this in Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS saved_addresses JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_delivery JSONB DEFAULT NULL;

-- Verify
SELECT id, full_name, saved_addresses, default_delivery FROM profiles LIMIT 3;
