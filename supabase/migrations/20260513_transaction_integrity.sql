-- Phase 4: Order Transaction Integrity Migration

-- 1. ADD TRANSACTION ID
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS transaction_id uuid UNIQUE;

-- 2. CREATE ATOMIC RPC FUNCTION
CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_restaurant_id uuid,
  p_short_code text,
  p_table_number text,
  p_intent text,
  p_total numeric,
  p_customer_session_id text,
  p_transaction_id uuid,
  p_items jsonb
) RETURNS uuid AS $$
DECLARE
  v_order_id uuid;
BEGIN
  -- Check if order with this transaction_id already exists (idempotency check)
  SELECT id INTO v_order_id FROM public.orders WHERE transaction_id = p_transaction_id;
  
  IF v_order_id IS NOT NULL THEN
    -- If it exists, return the existing order ID immediately (safe retry)
    RETURN v_order_id;
  END IF;

  -- Insert the new order
  INSERT INTO public.orders (
    restaurant_id, 
    short_code, 
    table_number, 
    intent, 
    status, 
    total, 
    customer_session_id, 
    transaction_id
  ) VALUES (
    p_restaurant_id, 
    p_short_code, 
    p_table_number, 
    p_intent, 
    'pending', 
    p_total, 
    p_customer_session_id, 
    p_transaction_id
  ) RETURNING id INTO v_order_id;

  -- Insert the items
  INSERT INTO public.order_items (
    order_id, 
    menu_item_id, 
    name, 
    qty, 
    price, 
    item_intent, 
    selected_option, 
    customer_session_id
  )
  SELECT 
    v_order_id,
    (item->>'menu_item_id')::uuid,
    item->>'name',
    (item->>'qty')::int,
    (item->>'price')::numeric,
    item->>'item_intent',
    item->>'selected_option',
    p_customer_session_id
  FROM jsonb_array_elements(p_items) AS item;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
