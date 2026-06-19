-- =====================================================
-- COMPLETE GEOFENCING SETUP — Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Add the columns (safely, won't fail if they already exist)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS geofencing_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS geofencing_radius INTEGER DEFAULT 300;

-- Step 2: Fix RLS so customers can READ the location data
-- (Without this, geofencing check always gets NULL and lets everyone in)
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public restaurants are viewable by everyone" ON restaurants;
CREATE POLICY "Public restaurants are viewable by everyone"
  ON restaurants FOR SELECT
  USING (true);

-- Step 3: Ensure owners can update their own restaurant
DROP POLICY IF EXISTS "Owners can update their restaurant" ON restaurants;
CREATE POLICY "Owners can update their restaurant"
  ON restaurants FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Step 4: Verify the columns were created (you should see them in the results)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'restaurants'
  AND column_name IN ('latitude', 'longitude', 'geofencing_enabled', 'geofencing_radius');
