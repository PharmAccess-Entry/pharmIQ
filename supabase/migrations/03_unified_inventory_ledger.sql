-- ============================================================
-- 03_unified_inventory_ledger.sql
-- PharmIQ: Production-Grade Inventory Traceability
--
-- Priorities 1 + 2: Unified ledger schema + DB-level trigger
-- This migration is ADDITIVE and SAFE to run on existing data.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pharmacy_order_item') THEN
    CREATE TYPE public.pharmacy_order_item AS (
      menu_item_id UUID,
      name TEXT,
      qty INTEGER,
      price NUMERIC,
      item_intent TEXT,
      notes TEXT
    );
  END IF;
END$$;

-- ============================================================
-- SECTION 1: Enrich inventory_logs to a full movement ledger
-- ============================================================

-- Add all required traceability columns if not present
ALTER TABLE public.inventory_logs
  ADD COLUMN IF NOT EXISTS movement_type  TEXT    NOT NULL DEFAULT 'adjustment',
  ADD COLUMN IF NOT EXISTS quantity_before INTEGER,
  ADD COLUMN IF NOT EXISTS quantity_after  INTEGER,
  ADD COLUMN IF NOT EXISTS reference_type TEXT,   -- 'order', 'purchase_order', 'reconciliation', 'import'
  ADD COLUMN IF NOT EXISTS reference_id   UUID,
  ADD COLUMN IF NOT EXISTS user_id        UUID,
  ADD COLUMN IF NOT EXISTS source         TEXT    NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS note           TEXT;

-- Migrate old 'reason' column values into movement_type where possible
UPDATE public.inventory_logs
SET movement_type = CASE
  WHEN reason = 'order'          THEN 'sale'
  WHEN reason LIKE 'refund%'     THEN 'refund'
  WHEN reason = 'purchase_order' THEN 'purchase'
  WHEN reason = 'restock'        THEN 'adjustment'
  WHEN reason = 'silent_edit'    THEN 'menu_edit'
  WHEN reason = 'auto_trigger'   THEN 'menu_edit'
  ELSE 'adjustment'
END
WHERE movement_type = 'adjustment';

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_inv_logs_movement_type ON public.inventory_logs(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_logs_user_id       ON public.inventory_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_inv_logs_ref_id        ON public.inventory_logs(reference_id);

-- ============================================================
-- SECTION 2: Add missing columns to shifts table
-- ============================================================
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS previous_shift_id            UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handover_discrepancy_cash     NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS handover_discrepancy_pos      NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS handover_discrepancy_transfers NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_pos                    NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_transfers              NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_pos                   NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_transfers             NUMERIC,
  ADD COLUMN IF NOT EXISTS settled_at                   TIMESTAMPTZ;

-- ============================================================
-- SECTION 3: DB-level trigger — the safety net
-- Fires AFTER any UPDATE to menu_items that changes stock_quantity.
-- Creates a 'menu_edit' log entry automatically.
-- App code sets pharmiq.skip_auto_log = 'true' to suppress
-- the trigger when it already writes its own enriched log entry.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_log_stock_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_skip BOOLEAN;
BEGIN
  -- Only fire when stock_quantity actually changed and item is tracked
  IF NEW.stock_quantity IS NOT DISTINCT FROM OLD.stock_quantity THEN
    RETURN NEW;
  END IF;

  IF NEW.track_inventory = false THEN
    RETURN NEW;
  END IF;

  -- Read session variable set by app to avoid double-logging
  BEGIN
    v_skip := current_setting('pharmiq.skip_auto_log')::BOOLEAN;
  EXCEPTION WHEN OTHERS THEN
    v_skip := false;
  END;

  IF v_skip THEN
    RETURN NEW;
  END IF;

  -- Auto-generate a ledger entry (catches silent edits like MenuManagement)
  INSERT INTO public.inventory_logs (
    restaurant_id,
    menu_item_id,
    change_qty,
    reason,
    movement_type,
    source,
    quantity_before,
    quantity_after,
    user_id,
    created_at
  ) VALUES (
    NEW.restaurant_id,
    NEW.id,
    NEW.stock_quantity - OLD.stock_quantity,
    'auto_logged',
    'menu_edit',
    'trigger',
    OLD.stock_quantity,
    NEW.stock_quantity,
    auth.uid(),
    now()
  );

  RETURN NEW;
END;
$$;

-- Drop old trigger if exists, then create fresh
DROP TRIGGER IF EXISTS trg_log_stock_change ON public.menu_items;
CREATE TRIGGER trg_log_stock_change
  AFTER UPDATE ON public.menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_stock_change();

-- ============================================================
-- SECTION 4: Atomic RPC — update_stock_with_reason
-- Single-call atomic stock mutation + audit log.
-- Used by Inventory.tsx adjust stock and receive stock flows.
-- ============================================================
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

-- ============================================================
-- SECTION 5: Patch process_pharmacy_sale to write inventory_logs
-- Replaces previous version — now logs per-item 'sale' entries.
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_pharmacy_sale(
  p_restaurant_id UUID,
  p_user_id       UUID,
  p_short_code    TEXT,
  p_table_number  TEXT,
  p_status        TEXT,
  p_payment_status TEXT,
  p_total         NUMERIC,
  p_customer_name TEXT,
  p_patient_id    UUID,
  p_cash_given    NUMERIC,
  p_intent        TEXT,
  p_items         pharmacy_order_item[]
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

  -- 2. Insert order
  INSERT INTO orders (
    restaurant_id, user_id, short_code, table_number,
    status, payment_status, total, customer_name, patient_id, cash_given, intent
  ) VALUES (
    p_restaurant_id, p_user_id, p_short_code, p_table_number,
    p_status, p_payment_status, p_total, p_customer_name, p_patient_id, p_cash_given, p_intent
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
        reference_type, reference_id, user_id, created_by, created_at
      ) VALUES (
        p_restaurant_id, v_item.menu_item_id, -v_item.qty, 'sale',
        'sale', 'pos', v_prev_qty, v_prev_qty - v_item.qty,
        'order', v_order_id, p_user_id, v_role_id, now()
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
      'item_count',  array_length(p_items, 1)
    )
  );

  RETURN v_order_id;
END;
$$;

-- ============================================================
-- SECTION 6: RPC — bulk_import_products
-- Used by the upgraded CSV import for large pharmacy inventories.
-- Handles duplicates via ON CONFLICT, returns import summary.
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_import_products(
  p_restaurant_id UUID,
  p_products      JSONB  -- array of product objects
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product     JSONB;
  v_inserted    INTEGER := 0;
  v_skipped     INTEGER := 0;
  v_item_id     UUID;
  v_prev_qty    INTEGER;
  v_new_qty     INTEGER;
BEGIN
  -- Tell trigger: we will log explicitly for imported items
  PERFORM set_config('pharmiq.skip_auto_log', 'true', true);

  FOR v_product IN SELECT * FROM jsonb_array_elements(p_products)
  LOOP
    v_new_qty := COALESCE((v_product->>'stock_quantity')::INTEGER, 0);

    -- Upsert by name + restaurant_id to handle re-imports gracefully
    INSERT INTO menu_items (
      restaurant_id, name, description, price, cost_price,
      category, available, track_inventory, stock_quantity,
      low_stock_threshold, batch_number, expiry_date, barcode, requires_prescription
    ) VALUES (
      p_restaurant_id,
      v_product->>'name',
      NULLIF(v_product->>'description', ''),
      COALESCE((v_product->>'price')::NUMERIC, 0),
      COALESCE((v_product->>'cost_price')::NUMERIC, 0),
      v_product->>'category',
      true,
      v_new_qty > 0,
      v_new_qty,
      COALESCE((v_product->>'low_stock_threshold')::INTEGER, 5),
      NULLIF(v_product->>'batch_number', ''),
      NULLIF(v_product->>'expiry_date', '')::DATE,
      NULLIF(v_product->>'barcode', ''),
      COALESCE((v_product->>'requires_prescription')::BOOLEAN, false)
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_item_id;

    IF v_item_id IS NOT NULL THEN
      v_inserted := v_inserted + 1;

      -- Write opening stock log if stock > 0
      IF v_new_qty > 0 THEN
        INSERT INTO inventory_logs (
          restaurant_id, menu_item_id, change_qty, reason,
          movement_type, source, quantity_before, quantity_after,
          user_id, created_at
        ) VALUES (
          p_restaurant_id, v_item_id, v_new_qty, 'opening_stock',
          'import', 'csv_import', 0, v_new_qty,
          auth.uid(), now()
        );
      END IF;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'skipped',  v_skipped,
    'total',    v_inserted + v_skipped
  );
END;
$$;
