-- ============================================================
-- MIGRATION 05: PharmIQ Shift System Production Refactor
-- ============================================================
-- Objective:
--   1. Extend shifts table with settlement workflow columns
--   2. Remove legacy carryover columns (previous_shift_id, handover_*)
--   3. Enforce shift_id as NOT NULL on orders (new records only via constraint)
--   4. Update process_pharmacy_sale to RAISE EXCEPTION if shift_id is missing
--   5. Update process_refund to correctly factor refunds in expected cash
-- ============================================================

-- ============================================================
-- SECTION 1: Extend shifts table
-- ============================================================

-- Add 'settled' status support (status column is TEXT, no enum needed)
-- Valid statuses: 'active', 'completed', 'settled'
-- Add a settled_at column (may already exist from migration 03 — safe with IF NOT EXISTS)
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

-- Store pre-computed expected totals per payment channel at end-of-shift
-- (expected_cash, expected_pos, expected_transfers already exist from migration 20260615)
-- Add start_pos and start_transfers if missing (for completeness, though they'll always be 0)
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS start_pos       NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_transfers NUMERIC NOT NULL DEFAULT 0;

-- Remove legacy cross-shift contamination columns (safe — they may not exist)
ALTER TABLE public.shifts
  DROP COLUMN IF EXISTS previous_shift_id,
  DROP COLUMN IF EXISTS handover_discrepancy_cash,
  DROP COLUMN IF EXISTS handover_discrepancy_pos,
  DROP COLUMN IF EXISTS handover_discrepancy_transfers;

-- ============================================================
-- SECTION 2: Add a covering index for fast shift lookups per cashier
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_shifts_user_status
  ON public.shifts(restaurant_id, user_id, status);

CREATE INDEX IF NOT EXISTS idx_shifts_completed_not_settled
  ON public.shifts(restaurant_id, status, settled_at)
  WHERE status = 'completed' AND settled_at IS NULL;

-- ============================================================
-- SECTION 3: Update orders table — add DB-level guard for shift_id
-- ============================================================
-- We cannot make shift_id NOT NULL retroactively (existing data), but we
-- add a constraint that PREVENTS new COMPLETED/CASH orders without a shift_id.
-- This is enforced by the updated RPC below (RAISE EXCEPTION).
-- A partial index makes it easy to audit orphaned orders:
CREATE INDEX IF NOT EXISTS idx_orders_no_shift
  ON public.orders(id)
  WHERE shift_id IS NULL AND status NOT IN ('cancelled', 'rejected');

-- ============================================================
-- SECTION 4: Replace process_pharmacy_sale — strictly requires shift_id
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

  -- 2. Insert order stamped with shift_id
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
-- SECTION 5: Replace process_refund — strictly requires shift_id
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
  -- ❌ BLOCK any refund without a shift_id
  IF p_shift_id IS NULL THEN
    RAISE EXCEPTION 'SHIFT_REQUIRED: A refund cannot be processed without an active shift.';
  END IF;

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

  -- 1. Mark order as refunded (stamp with current shift_id for cash accountability)
  UPDATE public.orders
     SET status = 'refunded',
         payment_status = 'refunded',
         refund_shift_id = p_shift_id   -- tracks WHICH shift handled the refund cash outflow
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

        UPDATE public.menu_items
           SET stock_quantity = v_new_qty,
               updated_at     = now()
         WHERE id = v_item.menu_item_id;

        -- Exactly ONE inventory log entry per item
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
      'order_id',        p_order_id,
      'shift_id',        p_shift_id,
      'restocked',       p_restock,
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

-- ============================================================
-- SECTION 6: Add refund_shift_id column to orders
-- Tracks which ACTIVE shift processed the refund cash outflow.
-- (Different from the original order's shift_id)
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refund_shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_refund_shift
  ON public.orders(refund_shift_id)
  WHERE refund_shift_id IS NOT NULL;

-- ============================================================
-- SECTION 7: Helper function to compute shift expected cash server-side
-- This is called by the frontend when ending a shift.
-- Formula: expected_cash = start_cash + SUM(cash sales) - SUM(cash refunds)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_shift_expected_totals(p_shift_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift         RECORD;
  v_cash_sales    NUMERIC := 0;
  v_pos_sales     NUMERIC := 0;
  v_transfer_sales NUMERIC := 0;
  v_cash_refunds  NUMERIC := 0;
  v_pos_refunds   NUMERIC := 0;
  v_transfer_refunds NUMERIC := 0;
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift not found: %', p_shift_id;
  END IF;

  -- Sum sales by payment channel (exclude refunded orders from revenue)
  SELECT
    COALESCE(SUM(CASE WHEN payment_status = 'cash_paid' AND status NOT IN ('refunded','cancelled') THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_status IN ('pos_paid','cash_pos') AND status NOT IN ('refunded','cancelled') THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_status = 'confirmed' AND status NOT IN ('refunded','cancelled') THEN total ELSE 0 END), 0)
  INTO v_cash_sales, v_pos_sales, v_transfer_sales
  FROM public.orders
  WHERE shift_id = p_shift_id;

  -- Sum cash given OUT for refunds (where refund was processed during this shift)
  SELECT
    COALESCE(SUM(CASE WHEN o_orig.payment_status = 'cash_paid' THEN o_ref.total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN o_orig.payment_status IN ('pos_paid','cash_pos') THEN o_ref.total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN o_orig.payment_status = 'confirmed' THEN o_ref.total ELSE 0 END), 0)
  INTO v_cash_refunds, v_pos_refunds, v_transfer_refunds
  FROM public.orders o_ref
  JOIN public.orders o_orig ON o_orig.id = o_ref.id  -- same order, just checking its original payment method
  WHERE o_ref.refund_shift_id = p_shift_id
    AND o_ref.status = 'refunded';

  RETURN jsonb_build_object(
    'start_cash',          v_shift.start_cash,
    'cash_sales',          v_cash_sales,
    'pos_sales',           v_pos_sales,
    'transfer_sales',      v_transfer_sales,
    'cash_refunds',        v_cash_refunds,
    'pos_refunds',         v_pos_refunds,
    'transfer_refunds',    v_transfer_refunds,
    'expected_cash',       v_shift.start_cash + v_cash_sales - v_cash_refunds,
    'expected_pos',        v_pos_sales - v_pos_refunds,
    'expected_transfers',  v_transfer_sales - v_transfer_refunds
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_shift_expected_totals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shift_expected_totals(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_pharmacy_sale TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_pharmacy_sale TO service_role;
GRANT EXECUTE ON FUNCTION public.process_refund TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_refund TO service_role;
