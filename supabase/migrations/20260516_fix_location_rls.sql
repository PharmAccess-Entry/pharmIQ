-- Allow anonymous users (customers) to see geofencing columns so the check can run
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- Ensure there is a policy for public viewing of restaurants
-- This might already exist, but we ensure the columns are accessible
DROP POLICY IF EXISTS "Public restaurants are viewable by everyone" ON restaurants;
CREATE POLICY "Public restaurants are viewable by everyone"
ON restaurants FOR SELECT
USING (true);
