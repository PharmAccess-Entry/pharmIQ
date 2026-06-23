-- ============================================================
-- 04_shift_id_integrity.sql
-- PharmIQ: Shift ID as Primary Accountability Key
--
-- Fixes:
--   1. Add shift_id FK to orders and inventory_logs
--   2. Update process_pharmacy_sale to stamp shift_id on every order
--   3. Update update_stock_with_reason to accept shift_id
--   4. Add process_refund RPC — single atomic refund path
-- ============================================================

-- ============================================================
-- SECTION 1: Add shift_id to orders table
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_shift_id ON public.orders(shift_id);

-- ============================================================
-- SECTION 2: Add shift_id to inventory_logs table
-- ============================================================
ALTER TABLE public.inventory_logs
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inv_logs_shift_id ON public.inventory_logs(shift_id);

-- ============================================================
-- SECTION 3: Add shift_id to stock_reconciliations table (if exists)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_reconciliations'
  ) THEN
    EXECUTE 'ALTER TABLE public.stock_reconciliations ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL';
  END IF;
END $$;

-- ============================================================
-- SECTION 4: Update update_stock_with_reason RPC to accept shift_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_stock_with_reason(
  p_restaurant_id  UUID,
  p_menu_item_id   UUID,
  p_change_qty     INTEGER,
  p_reason         TEXT,
  p_movement_type  TEXT    DEFAULT 'adjustment',
  p_note           TEXT    DEFAULT NULL,
  p_reference_id   UUID    DEFAULT NULL,
  p_reference_type TEXT    DEFAULT NULL,
  p_shift_id       UUID    DEFAULT NULL
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

  -- Write the authoritative, enriched log entry (now with shift_id)
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
    shift_id,
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
    p_shift_id,
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

-- ============================================================
-- SECTION 5: Update process_pharmacy_sale RPC to stamp shift_id
-- ============================================================
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
  p_shift_id       UUID    DEFAULT NULL
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

  -- 2. Insert order — NOW WITH shift_id
  INSERT INTO orders (
    restaurant_id, user_id, short_code, table_number,
    status, payment_status, total, customer_name, patient_id, cash_given, intent, shift_id
  ) VALUES (
    p_restaurant_id, p_user_id, p_short_code, p_table_number,
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

-- ============================================================
-- SECTION 6: New process_refund RPC — single authoritative path
-- Replaces the raw frontend refund logic entirely.
-- Accepts shift_id to stamp the cash event on the CURRENT shift,
-- not retroactively on the original order's shift.
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_refund(
  p_order_id    UUID,
  p_user_id     UUID,
  p_restock     BOOLEAN DEFAULT true,
  p_shift_id    UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order       RECORD;
  v_item        RECORD;
  v_menu_item   RECORD;
  v_role_id     UUID;
  v_prev_qty    INTEGER;
  v_new_qty     INTEGER;
  v_refund_count INTEGER := 0;
BEGIN
  -- Fetch the order
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- Prevent double-refunds
  IF v_order.status = 'refunded' THEN
    RAISE EXCEPTION 'Order % has already been refunded.', p_order_id;
  END IF;

  -- Look up user role
  SELECT id INTO v_role_id
    FROM public.user_roles
   WHERE user_id = p_user_id AND restaurant_id = v_order.restaurant_id
   LIMIT 1;

  -- 1. Mark order as refunded
  UPDATE public.orders
     SET status = 'refunded', payment_status = 'refunded'
   WHERE id = p_order_id;

  -- 2. If restocking: iterate order items, restock tracked inventory
  IF p_restock THEN
    PERFORM set_config('pharmiq.skip_auto_log', 'true', true);

    FOR v_item IN
      SELECT oi.menu_item_id, oi.qty
        FROM public.order_items oi
       WHERE oi.order_id = p_order_id
         AND oi.menu_item_id IS NOT NULL
    LOOP
      SELECT id, stock_quantity, track_inventory, restaurant_id
        INTO v_menu_item
        FROM public.menu_items
       WHERE id = v_item.menu_item_id
       FOR UPDATE;

      IF FOUND AND v_menu_item.track_inventory THEN
        v_prev_qty := v_menu_item.stock_quantity;
        v_new_qty  := v_prev_qty + v_item.qty;

        -- Restock
        UPDATE public.menu_items
           SET stock_quantity = v_new_qty,
               updated_at     = now()
         WHERE id = v_item.menu_item_id;

        -- Write exactly ONE inventory log entry per item with full traceability
        INSERT INTO public.inventory_logs (
          restaurant_id, menu_item_id, change_qty, reason,
          movement_type, source, quantity_before, quantity_after,
          reference_type, reference_id, user_id, created_by, shift_id, created_at
        ) VALUES (
          v_menu_item.restaurant_id,
          v_item.menu_item_id,
          v_item.qty,
          'refund',
          'refund',
          'pos',
          v_prev_qty,
          v_new_qty,
          'order',
          p_order_id,
          p_user_id,
          v_role_id,
          p_shift_id,
          now()
        );

        v_refund_count := v_refund_count + 1;
      END IF;
    END LOOP;
  END IF;

  -- 3. Audit log
  INSERT INTO public.audit_logs (
    restaurant_id, user_id, action, record_id, new_data
  ) VALUES (
    v_order.restaurant_id,
    p_user_id,
    'REFUND_PROCESSED',
    p_order_id::TEXT,
    jsonb_build_object(
      'order_id',      p_order_id,
      'shift_id',      p_shift_id,
      'restocked',     p_restock,
      'items_restocked', v_refund_count
    )
  );

  RETURN jsonb_build_object(
    'ok',              true,
    'order_id',        p_order_id,
    'restocked_items', v_refund_count
  );
END;
$$;
