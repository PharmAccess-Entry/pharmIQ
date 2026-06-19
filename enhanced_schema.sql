-- SmartTable NG: Staff Performance Schema
-- Add tracking columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES auth.users(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- Add tracking columns to order_messages
ALTER TABLE public.order_messages ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES auth.users(id);

-- Add staff tracking to customer_requests
ALTER TABLE public.customer_requests ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id);
ALTER TABLE public.customer_requests ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Update RLS for staff tracking (assuming profiles table has roles)
-- Note: Roles are already managed in the application layer, 
-- but these columns provide the database audit trail.
