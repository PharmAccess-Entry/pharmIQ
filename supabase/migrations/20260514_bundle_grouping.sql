-- Migration: Add bundle_id to order_items to support grouped combo rendering
-- Date: 2026-05-14

-- 1. Add bundle_id column
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS bundle_id UUID;

-- 2. Update the atomic order creation function to handle bundle_id
CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_restaurant_id UUID,
  p_table_number TEXT,
  p_items JSONB, -- Array of items: {menu_id, qty, price, name, selected_option, item_intent, notes, bundle_id}
  p_payment_method TEXT DEFAULT 'cash',
  p_total NUMERIC DEFAULT 0,
  p_event_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
BEGIN
  -- Insert the main order
  INSERT INTO public.orders (
    restaurant_id, 
    table_number, 
    payment_method, 
    total, 
    status, 
    payment_status,
    event_id
  )
  VALUES (
    p_restaurant_id, 
    p_table_number, 
    p_payment_method, 
    p_total, 
    'pending', 
    'unpaid',
    p_event_id
  )
  RETURNING id INTO v_order_id;

  -- Insert each order item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      menu_id,
      qty,
      price,
      name,
      selected_option,
      item_intent,
      notes,
      bundle_id
    )
    VALUES (
      v_order_id,
      (v_item->>'menu_id')::UUID,
      (v_item->>'qty')::INTEGER,
      (v_item->>'price')::NUMERIC,
      (v_item->>'name'),
      (v_item->>'selected_option'),
      (v_item->>'item_intent'),
      (v_item->>'notes'),
      (v_item->>'bundle_id')::UUID
    );
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
