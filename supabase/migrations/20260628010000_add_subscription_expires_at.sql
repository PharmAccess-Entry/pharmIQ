-- Add subscription_expires_at column to restaurants table
-- Required by paystack-verify to track when subscriptions expire

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

COMMENT ON COLUMN restaurants.subscription_expires_at IS 'The date when the current subscription period ends. NULL if on free trial.';
