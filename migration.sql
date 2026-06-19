-- SmartTable NG: 3-Status Kitchen Workflow Migration
-- Run this in your Supabase SQL Editor to align existing orders with the new model.

-- 1. Map legacy 'awaiting_payment' to 'preparing' (Kitchen-first logic)
UPDATE public.orders 
SET status = 'preparing' 
WHERE status = 'awaiting_payment';

-- 2. Map legacy 'paid' to 'served' (implicit payment logic)
UPDATE public.orders 
SET status = 'served' 
WHERE status = 'paid';

-- 3. (Optional) Cleanup any legacy status values that are no longer used
-- Check if any orders have status not in ('pending', 'preparing', 'served')
-- SELECT id, status FROM public.orders WHERE status NOT IN ('pending', 'preparing', 'served');

-- 4. Note on Revenue:
-- The new dashboard strictly counts 'served' orders for revenue.
-- Historical 'paid' orders updated to 'served' above will now count towards revenue.
