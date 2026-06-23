-- ============================================================
-- 02_inventory_audit_trigger.sql
-- PharmIQ: Close all inventory traceability loopholes
-- 
-- Changes:
--   1. Add `user_id` + `source` columns to inventory_logs
--   2. Create RPC: update_stock_with_reason (atomic stock + log)
--   3. Create trigger: trg_log_stock_change (safety net for UI edits)
--   4. Patch process_pharmacy_sale to also write inventory_logs
-- ============================================================

-- ============================================================
-- Step 1: Enrich inventory_logs schema
-- ============================================================
ALTER TABLE public.inventory_logs
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_inventory_logs_user ON public.inventory_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_source ON public.inventory_logs(source);

-- ============================================================
-- Step 2: Trigger function — safety net for silent edits
-- This fires AFTER any UPDATE to menu_items that changes
-- stock_quantity. It records the change automatically.
-- It reads a session variable to avoid double-logging when
-- the application has already inserted a manual log entry.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_log_stock_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only act if stock actually changed AND the item tracks inventory
  IF NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity
     AND NEW.track_inventory = true THEN

    -- Skip if the application has already logged this change manually.
    -- The app sets pharmiq.skip_auto_log = 'true' before its own insert.
    IF current_setting('pharmiq.skip_auto_log', true) = 'true' THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.inventory_logs (
      restaurant_id,
      menu_item_id,
      change_qty,
      reason,
      source,
      user_id,
      created_at
    ) VALUES (
      NEW.restaurant_id,
      NEW.id,
      NEW.stock_quantity - OLD.stock_quantity,
      'silent_edit',   -- distinguishes untracked edits (e.g., from MenuManagement)
      'auto_trigger',
      auth.uid(),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_log_stock_change ON public.menu_items;
CREATE TRIGGER trg_log_stock_change
  AFTER UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_stock_change();

-- ============================================================
-- Step 3: Atomic RPC — update_stock_with_reason
-- This replaces the 2-step pattern (update menu_items, then
-- insert inventory_logs) with a single atomic database call.
-- It sets the session flag to prevent the trigger from firing
-- a duplicate log entry.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_stock_with_reason(
  p_restaurant_id   UUID,
  p_menu_item_id    UUID,
  p_change_qty      INTEGER,        -- positive = add, negative = remove
  p_reason          TEXT,
  p_source          TEXT DEFAULT 'manual',
  p_note            TEXT DEFAULT NULL,
  p_order_id        UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_qty   INTEGER;
  v_new_qty       INTEGER;
  v_was_hidden    BOOLEAN;
  v_auto_hide     BOOLEAN;
BEGIN
  -- Lock the row for this operation
  SELECT stock_quantity, available, auto_hide_out_of_stock
    INTO v_current_qty, v_was_hidden, v_auto_hide
    FROM public.menu_items
   WHERE id = p_menu_item_id
     AND restaurant_id = p_restaurant_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_menu_item_id;
  END IF;

  v_new_qty := GREATEST(0, v_current_qty + p_change_qty);

  -- Tell the trigger: we are already logging this, don't duplicate.
  SET LOCAL pharmiq.skip_auto_log = 'true';

  -- Update the stock
  UPDATE public.menu_items
     SET stock_quantity = v_new_qty,
         -- Re-enable if was auto-hidden and now back in stock
         available = CASE
           WHEN v_auto_hide AND v_current_qty <= 0 AND v_new_qty > 0 THEN true
           ELSE available
         END,
         updated_at = now()
   WHERE id = p_menu_item_id;

  -- Insert the explicit, enriched audit log
  INSERT INTO public.inventory_logs (
    restaurant_id,
    menu_item_id,
    change_qty,
    reason,
    source,
    note,
    order_id,
    user_id,
    created_by,
    created_at
  ) VALUES (
    p_restaurant_id,
    p_menu_item_id,
    p_change_qty,
    p_reason,
    p_source,
    p_note,
    p_order_id,
    auth.uid(),
    (SELECT id FROM public.user_roles WHERE user_id = auth.uid() AND restaurant_id = p_restaurant_id LIMIT 1),
    now()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'previous_qty', v_current_qty,
    'new_qty', v_new_qty,
    'change', p_change_qty
  );
END;
$$;

-- ============================================================
-- Step 4: Patch process_pharmacy_sale to write inventory_logs
-- This ensures every POS sale is captured in inventory_logs
-- with source = 'sale', not just in audit_logs.
-- ============================================================
CREATE OR REPLACE FUNCTION process_pharmacy_sale(
  p_restaurant_id UUID,
  p_user_id UUID,
  p_short_code TEXT,
  p_table_number TEXT,
  p_status TEXT,
  p_payment_status TEXT,
  p_total NUMERIC,
  p_customer_name TEXT,
  p_patient_id UUID,
  p_cash_given NUMERIC,
  p_intent TEXT,
  p_items pharmacy_order_item[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_item pharmacy_order_item;
  v_drug RECORD;
BEGIN
  -- 1. Validate all items before committing any writes
  FOREACH v_item IN ARRAY p_items
  LOOP
    SELECT * INTO v_drug
    FROM menu_items
    WHERE id = v_item.menu_item_id
      AND restaurant_id = p_restaurant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % not found in this pharmacy.', v_item.menu_item_id;
    END IF;

    IF v_drug.track_inventory = true THEN
      IF v_drug.stock_quantity < v_item.qty THEN
        RAISE EXCEPTION 'Insufficient stock for % (Requested: %, Available: %)',
          v_drug.name, v_item.qty, v_drug.stock_quantity;
      END IF;
    END IF;

    IF v_drug.requires_prescription = true AND p_patient_id IS NULL THEN
      RAISE EXCEPTION 'Prescription required for % but no patient was linked.', v_drug.name;
    END IF;
  END LOOP;

  -- 2. Insert Order
  INSERT INTO orders (
    restaurant_id, user_id, short_code, table_number, status,
    payment_status, total, customer_name, patient_id, cash_given, intent
  ) VALUES (
    p_restaurant_id, p_user_id, p_short_code, p_table_number, p_status,
    p_payment_status, p_total, p_customer_name, p_patient_id, p_cash_given, p_intent
  ) RETURNING id INTO v_order_id;

  -- 3. Tell trigger: app will log explicitly, skip auto-trigger
  SET LOCAL pharmiq.skip_auto_log = 'true';

  -- 4. Insert order items, deduct stock, and write inventory logs
  FOREACH v_item IN ARRAY p_items
  LOOP
    INSERT INTO order_items (
      order_id, menu_item_id, name, qty, price, item_intent, notes
    ) VALUES (
      v_order_id, v_item.menu_item_id, v_item.name, v_item.qty,
      v_item.price, v_item.item_intent, v_item.notes
    );

    -- Deduct stock (only for tracked items)
    UPDATE menu_items
       SET stock_quantity = stock_quantity - v_item.qty
     WHERE id = v_item.menu_item_id AND track_inventory = true;

    -- Write item-level inventory log entry
    INSERT INTO inventory_logs (
      restaurant_id, menu_item_id, change_qty, reason, source,
      order_id, user_id, created_by, created_at
    )
    SELECT
      p_restaurant_id,
      v_item.menu_item_id,
      -v_item.qty,
      'sale',
      'sale',
      v_order_id,
      p_user_id,
      (SELECT id FROM user_roles WHERE user_id = p_user_id AND restaurant_id = p_restaurant_id LIMIT 1),
      now()
    WHERE EXISTS (
      SELECT 1 FROM menu_items
       WHERE id = v_item.menu_item_id AND track_inventory = true
    );
  END LOOP;

  -- 5. High-level audit log (order summary)
  INSERT INTO audit_logs (
    restaurant_id, user_id, action, record_id, new_data
  ) VALUES (
    p_restaurant_id, p_user_id, 'SALE_COMPLETED', v_order_id::TEXT,
    jsonb_build_object(
      'short_code', p_short_code,
      'total', p_total,
      'item_count', array_length(p_items, 1)
    )
  );

  RETURN v_order_id;
END;
$$;
