-- Phase 2: Order Session Ownership Lock Migration

-- 1. ADD COLUMNS
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_session_id text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS customer_session_id text;
ALTER TABLE public.order_messages ADD COLUMN IF NOT EXISTS customer_session_id text;

-- 2. UPDATE RLS FOR ORDERS
DROP POLICY IF EXISTS "orders_update_staff" ON public.orders;

-- Staff can update their restaurant's orders, and anonymous users can update their own order 
-- (e.g. to mark as acknowledged, though typically only staff updates orders). 
-- To be safe, we allow customers to update ONLY IF they match the customer_session_id.
DROP POLICY IF EXISTS "orders_update_session" ON public.orders;
CREATE POLICY "orders_update_session" ON public.orders FOR UPDATE 
USING (
  is_staff(restaurant_id) 
  OR 
  (customer_session_id IS NOT NULL AND customer_session_id = current_setting('request.headers', true)::json->>'x-session-id')
) 
WITH CHECK (
  is_staff(restaurant_id) 
  OR 
  (customer_session_id IS NOT NULL AND customer_session_id = current_setting('request.headers', true)::json->>'x-session-id')
);


-- 3. UPDATE RLS FOR ORDER ITEMS
DROP POLICY IF EXISTS "order_items_insert_public" ON public.order_items;

-- Customers can insert items, but ONLY if they match the parent order's customer_session_id
DROP POLICY IF EXISTS "order_items_insert_session" ON public.order_items;
CREATE POLICY "order_items_insert_session" ON public.order_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_id AND o.customer_session_id = order_items.customer_session_id
  )
);


-- Customers can insert messages, but ONLY if they match the parent order's customer_session_id
-- Staff can also insert messages.
DROP POLICY IF EXISTS "order_messages_insert_session" ON public.order_messages;
CREATE POLICY "order_messages_insert_session" ON public.order_messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_id AND (
      is_staff(o.restaurant_id) 
      OR 
      o.customer_session_id = order_messages.customer_session_id
    )
  )
);

-- Note: SELECT policies remain `USING (true)` so realtime continues to work. 
-- The frontend explicitly filters `.eq('customer_session_id', session_id)` to hide it in the UI.
