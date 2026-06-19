-- ============================================================
-- Shift Management & Audit Layer Migration
-- ============================================================

-- 1. Add staff_id to track accountability
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL;

-- 2. Create the shifts table
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed'
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  start_cash NUMERIC NOT NULL DEFAULT 0,
  expected_cash NUMERIC DEFAULT 0,
  actual_cash NUMERIC,
  expected_pos NUMERIC DEFAULT 0,
  actual_pos NUMERIC,
  expected_transfers NUMERIC DEFAULT 0,
  actual_transfers NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for shifts
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissive_shifts" ON public.shifts FOR ALL USING (true) WITH CHECK (true);

-- Index for shifts
CREATE INDEX IF NOT EXISTS idx_shifts_restaurant ON public.shifts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user ON public.shifts(user_id);

-- Trigger to update updated_at
CREATE TRIGGER touch_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();

-- ============================================================
-- Subscription Billing Logic Update
-- Note: This assumes you have an edge function or RPC that calculates billing.
-- Below is an example view that calculates the expected monthly subscription revenue.
-- ============================================================

CREATE OR REPLACE VIEW public.subscription_revenue AS
SELECT 
  id as restaurant_id,
  name,
  business_type,
  CASE 
    WHEN business_type = 'pharmacy' THEN 5000
    ELSE GREATEST(1, table_count) * 2000
  END as expected_monthly_revenue
FROM public.restaurants;

-- Grant access to the view
GRANT SELECT ON public.subscription_revenue TO authenticated;
GRANT SELECT ON public.subscription_revenue TO service_role;
