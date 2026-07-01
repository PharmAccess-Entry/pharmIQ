-- ============================================================
-- 20260701000000_fix_rpc_ambiguity.sql
-- Fix: "could not choose best candidate" for update_stock_with_reason
-- Drops ALL overloads and recreates a single, canonical version.
-- Also ensures purchase → inventory flow works correctly.
-- ============================================================

-- Drop ALL versions of this function to eliminate ambiguity
DROP FUNCTION IF EXISTS public.update_stock_with_reason(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.update_stock_with_reason(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.update_stock_with_reason(UUID, UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.update_stock_with_reason(UUID, UUID, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_stock_with_reason(UUID, UUID, INTEGER, TEXT, TEXT, TEXT);

-- Recreate a single canonical version with explicit parameter defaults
CREATE OR REPLACE FUNCTION public.update_stock_with_reason(
  p_restaurant_id  UUID,
  p_menu_item_id   UUID,
  p_change_qty     INTEGER,
  p_reason         TEXT,
  p_movement_type  TEXT    DEFAULT 'adjustment',
  p_note           TEXT    DEFAULT NULL,
  p_reference_id   UUID    DEFAULT NULL,
  p_reference_type TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_qty   INTEGER;
  v_new_qty       INTEGER;
  v_auto_hide     BOOLEAN;
  v_available     BOOLEAN;
  v_role_id       UUID;
BEGIN
  -- Lock and fetch current state
  SELECT stock_quantity, auto_hide_out_of_stock, available
    INTO v_current_qty, v_auto_hide, v_available
    FROM public.menu_items
   WHERE id = p_menu_item_id
     AND restaurant_id = p_restaurant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_menu_item_id;
  END IF;

  v_new_qty := GREATEST(0, v_current_qty + p_change_qty);

  -- Look up user role ID for created_by FK
  SELECT id INTO v_role_id
    FROM public.user_roles
   WHERE user_id = auth.uid()
     AND restaurant_id = p_restaurant_id
   LIMIT 1;

  -- Tell trigger: we are logging ourselves, skip auto-trigger
  PERFORM set_config('pharmiq.skip_auto_log', 'true', true);

  -- Update stock
  UPDATE public.menu_items
     SET stock_quantity = v_new_qty,
         available = CASE
           WHEN v_auto_hide AND v_current_qty <= 0 AND v_new_qty > 0 THEN true
           ELSE v_available
         END,
         updated_at = now()
   WHERE id = p_menu_item_id;

  -- Write the authoritative, enriched log entry
  INSERT INTO public.inventory_logs (
    restaurant_id,
    menu_item_id,
    change_qty,
    reason,
    movement_type,
    source,
    quantity_before,
    quantity_after,
    reference_type,
    reference_id,
    note,
    user_id,
    created_by,
    created_at
  ) VALUES (
    p_restaurant_id,
    p_menu_item_id,
    p_change_qty,
    p_reason,
    p_movement_type,
    'app',
    v_current_qty,
    v_new_qty,
    p_reference_type,
    p_reference_id,
    p_note,
    auth.uid(),
    v_role_id,
    now()
  );

  RETURN jsonb_build_object(
    'ok',            true,
    'previous_qty',  v_current_qty,
    'new_qty',       v_new_qty,
    'change',        p_change_qty
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.update_stock_with_reason(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;
