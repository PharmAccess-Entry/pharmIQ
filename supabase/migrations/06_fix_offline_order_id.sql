-- ============================================================
-- MIGRATION 06: Fix offline order ID sync
-- ============================================================
-- Objective:
--   Update process_pharmacy_sale to accept p_order_id so offline-generated
--   order IDs match the server and notification links work correctly.

CREATE OR REPLACE FUNCTION public.process_pharmacy_sale(
  p_restaurant_id  UUID,
  p_user_id        UUID,
  p_short_code     TEXT,
  p_table_number   TEXT,
  p_status         TEXT,
  p_payment_status TEXT,
  p_total          NUMERIC,
  p_customer_name  TEXT,
  p_patient_id     UUID,
  p_cash_given     NUMERIC,
  p_intent         TEXT,
  p_items          pharmacy_order_item[],
  p_shift_id       UUID    DEFAULT NULL,
  p_order_id       UUID    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id  UUID;
  v_item      pharmacy_order_item;
  v_drug      RECORD;
  v_role_id   UUID;
  v_prev_qty  INTEGER;
BEGIN
  -- ❌ BLOCK any sale without a shift_id
  IF p_shift_id IS NULL THEN
    RAISE EXCEPTION 'SHIFT_REQUIRED: A sale cannot be processed without an active shift. Please start a shift first.';
  END IF;

  -- Validate shift is active and belongs to this user + restaurant
  IF NOT EXISTS (
    SELECT 1 FROM public.shifts
    WHERE id = p_shift_id
      AND restaurant_id = p_restaurant_id
      AND user_id = p_user_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'INVALID_SHIFT: Shift % is not active or does not belong to this cashier.', p_shift_id;
  END IF;

  -- Look up user role once
  SELECT id INTO v_role_id
    FROM public.user_roles
   WHERE user_id = p_user_id AND restaurant_id = p_restaurant_id
   LIMIT 1;

  -- 1. Validate all items (stock + prescription checks) before any writes
  FOREACH v_item IN ARRAY p_items
  LOOP
    SELECT * INTO v_drug
      FROM menu_items
     WHERE id = v_item.menu_item_id AND restaurant_id = p_restaurant_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % not found in this pharmacy.', v_item.menu_item_id;
    END IF;

    IF v_drug.track_inventory = true AND v_drug.stock_quantity < v_item.qty THEN
      RAISE EXCEPTION 'Insufficient stock for % (Requested: %, Available: %)',
        v_drug.name, v_item.qty, v_drug.stock_quantity;
    END IF;

    IF v_drug.requires_prescription = true AND p_patient_id IS NULL THEN
      RAISE EXCEPTION 'Prescription required for % but no patient was linked.', v_drug.name;
    END IF;
  END LOOP;

  -- 2. Insert order stamped with shift_id, using provided p_order_id if given
  INSERT INTO orders (
    id, restaurant_id, user_id, short_code, table_number,
    status, payment_status, total, customer_name, patient_id, cash_given, intent, shift_id
  ) VALUES (
    COALESCE(p_order_id, gen_random_uuid()), p_restaurant_id, p_user_id, p_short_code, p_table_number,
    p_status, p_payment_status, p_total, p_customer_name, p_patient_id, p_cash_given, p_intent, p_shift_id
  ) RETURNING id INTO v_order_id;

  -- Tell trigger: we will log explicitly
  PERFORM set_config('pharmiq.skip_auto_log', 'true', true);

  -- 3. Insert order items, deduct stock, write inventory log per item
  FOREACH v_item IN ARRAY p_items
  LOOP
    INSERT INTO order_items (
      order_id, menu_item_id, name, qty, price, item_intent, notes
    ) VALUES (
      v_order_id, v_item.menu_item_id, v_item.name,
      v_item.qty, v_item.price, v_item.item_intent, v_item.notes
    );

    -- Only deduct + log if tracked
    IF EXISTS (SELECT 1 FROM menu_items WHERE id = v_item.menu_item_id AND track_inventory = true) THEN
      SELECT stock_quantity INTO v_prev_qty FROM menu_items WHERE id = v_item.menu_item_id;

      UPDATE menu_items
         SET stock_quantity = stock_quantity - v_item.qty
       WHERE id = v_item.menu_item_id AND track_inventory = true;

      INSERT INTO inventory_logs (
        restaurant_id, menu_item_id, change_qty, reason,
        movement_type, source, quantity_before, quantity_after,
        reference_type, reference_id, user_id, created_by, shift_id, created_at
      ) VALUES (
        p_restaurant_id, v_item.menu_item_id, -v_item.qty, 'sale',
        'sale', 'pos', v_prev_qty, v_prev_qty - v_item.qty,
        'order', v_order_id, p_user_id, v_role_id, p_shift_id, now()
      );
    END IF;
  END LOOP;

  -- 4. High-level audit log
  INSERT INTO audit_logs (
    restaurant_id, user_id, action, record_id, new_data
  ) VALUES (
    p_restaurant_id, p_user_id, 'SALE_COMPLETED', v_order_id::TEXT,
    jsonb_build_object(
      'short_code',  p_short_code,
      'total',       p_total,
      'shift_id',    p_shift_id,
      'item_count',  array_length(p_items, 1)
    )
  );

  RETURN v_order_id;
END;
$$;
