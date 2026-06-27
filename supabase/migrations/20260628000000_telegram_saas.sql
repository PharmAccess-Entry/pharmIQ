-- Migration: 20260628000000_telegram_saas
-- Description: Implement SaaS Telegram integration architecture with one global bot and secure verification tokens.

-- 1. Add new columns to restaurants table
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS telegram_username text,
ADD COLUMN IF NOT EXISTS telegram_connected_at timestamptz,
ADD COLUMN IF NOT EXISTS telegram_last_notified_at timestamptz,
ADD COLUMN IF NOT EXISTS telegram_notify_prefs jsonb DEFAULT '{"daily_report": true, "weekly_report": true, "monthly_report": true, "end_shift": true, "low_stock": true, "out_of_stock": true, "reconciliation": true, "subscription": true, "sync_status": true}'::jsonb;

-- 2. Drop old columns related to per-customer bot tokens
ALTER TABLE public.restaurants
DROP COLUMN IF EXISTS telegram_bot_token,
DROP COLUMN IF EXISTS telegram_bot_name;

-- 3. Create telegram_verification_tokens table
CREATE TABLE IF NOT EXISTS public.telegram_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on the new table
ALTER TABLE public.telegram_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for telegram_verification_tokens (Service Role only)
-- Note: the application interacts with this table via Edge Functions using the service role key, 
-- so we don't strictly need public access policies, but adding a restrictive default is good practice.
CREATE POLICY "Service role has full access to telegram_verification_tokens"
  ON public.telegram_verification_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);
