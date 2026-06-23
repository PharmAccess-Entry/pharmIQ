-- ============================================================
-- 07_product_compliance.sql
-- PharmIQ: Product Compliance Remediation
-- Adds unit column to menu_items and updates bulk_import_products RPC
-- SAFE to run on existing data (additive only)
-- ============================================================

-- 1. Add unit column to menu_items (nullable, backward-compatible)
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS unit TEXT;

CREATE INDEX IF NOT EXISTS idx_menu_items_unit ON public.menu_items(unit);

-- ============================================================
-- 2. Update bulk_import_products RPC to support unit field
--    and enforce opening stock cannot be null
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
  v_new_qty     INTEGER;
BEGIN
  -- Tell trigger: we will log explicitly for imported items
  PERFORM set_config('pharmiq.skip_auto_log', 'true', true);

  FOR v_product IN SELECT * FROM jsonb_array_elements(p_products)
  LOOP
    v_new_qty := COALESCE((v_product->>'opening_stock')::INTEGER, 0);

    -- Upsert by name + restaurant_id to handle re-imports gracefully
    INSERT INTO menu_items (
      restaurant_id, name, description, price, cost_price,
      category, available, track_inventory, stock_quantity,
      low_stock_threshold, batch_number, expiry_date, barcode,
      requires_prescription, unit
    ) VALUES (
      p_restaurant_id,
      v_product->>'name',
      NULLIF(v_product->>'description', ''),
      COALESCE((v_product->>'price')::NUMERIC, 0),
      COALESCE((v_product->>'cost_price')::NUMERIC, 0),
      v_product->>'category',
      false,  -- starts OFF-SHELF; pharmacist must toggle live
      true,   -- always track inventory for pharmacy imports
      v_new_qty,
      COALESCE((v_product->>'low_stock_threshold')::INTEGER, 5),
      NULLIF(v_product->>'batch_number', ''),
      NULLIF(v_product->>'expiry_date', '')::DATE,
      NULLIF(v_product->>'barcode', ''),
      COALESCE((v_product->>'requires_prescription')::BOOLEAN, false),
      NULLIF(v_product->>'unit', '')
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

-- ============================================================
-- Done.
-- ============================================================
