-- ============================================================
-- Inventory Management Migration
-- Run this ENTIRE script in your Supabase SQL Editor
-- ============================================================

-- 1. Add inventory columns to menu_items (all default to OFF — fully backward compatible)
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS track_inventory        BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_quantity         INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold    INTEGER  NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS auto_hide_out_of_stock BOOLEAN  NOT NULL DEFAULT false;

-- 2. Create inventory_logs table
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id   uuid        NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  restaurant_id  uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  change_qty     INTEGER     NOT NULL,
  reason         TEXT        NOT NULL DEFAULT 'manual_adjustment',
  order_id       uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  note           TEXT,
  created_by     uuid,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissive_inventory_logs" ON public.inventory_logs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_menu_item  ON public.inventory_logs(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_restaurant ON public.inventory_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_track_inventory ON public.menu_items(restaurant_id, track_inventory);

-- ============================================================
-- 3. Helper: Insert a notification for stock alerts
--    (inserts only if the same alert wasn't sent in the last 30 min)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_stock_alert(
  p_restaurant_id uuid,
  p_menu_item_id  uuid,
  p_item_name     text,
  p_stock         integer,
  p_threshold     integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _type  text;
  _title text;
  _body  text;
  _link  text := '/dashboard/inventory';
BEGIN
  IF p_stock = 0 THEN
    _type  := 'stock_out';
    _title := '🚨 Out of Stock: ' || p_item_name;
    _body  := p_item_name || ' has run out of stock. Restock or hide from the menu.';
  ELSE
    _type  := 'low_stock';
    _title := '⚠️ Low Stock: ' || p_item_name;
    _body  := p_item_name || ' is low — only ' || p_stock || ' left (threshold: ' || p_threshold || ').';
  END IF;

  -- Deduplicate: don't spam the same alert within 30 minutes
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE restaurant_id = p_restaurant_id
      AND type = _type
      AND title = _title
      AND created_at > now() - interval '30 minutes'
  ) THEN
    INSERT INTO public.notifications (restaurant_id, type, title, body, link)
    VALUES (p_restaurant_id, _type, _title, _body, _link);
  END IF;
END;
$$;

-- ============================================================
-- 4. Trigger: Deduct stock when an order_item is inserted
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_inventory_deduct()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _item      public.menu_items%ROWTYPE;
  _new_stock integer;
  _rid       uuid;
BEGIN
  IF NEW.menu_item_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO _item FROM public.menu_items WHERE id = NEW.menu_item_id;
  IF NOT FOUND OR NOT _item.track_inventory THEN RETURN NEW; END IF;

  -- Deduct stock, floor at 0
  _new_stock := GREATEST(0, _item.stock_quantity - NEW.qty);

  UPDATE public.menu_items
    SET stock_quantity = _new_stock,
        updated_at     = now()
  WHERE id = NEW.menu_item_id;

  -- Auto-hide if stock hits 0 and auto_hide is enabled
  IF _new_stock = 0 AND _item.auto_hide_out_of_stock THEN
    UPDATE public.menu_items SET available = false WHERE id = NEW.menu_item_id;
  END IF;

  -- Get restaurant_id from the order
  SELECT restaurant_id INTO _rid FROM public.orders WHERE id = NEW.order_id;

  -- Log the deduction
  IF _rid IS NOT NULL THEN
    INSERT INTO public.inventory_logs (menu_item_id, restaurant_id, change_qty, reason, order_id)
    VALUES (NEW.menu_item_id, _rid, -NEW.qty, 'order_placed', NEW.order_id);

    -- Fire alert if stock hits 0 OR crosses the low threshold
    IF _new_stock = 0 OR (_new_stock <= _item.low_stock_threshold AND _item.stock_quantity > _item.low_stock_threshold) THEN
      PERFORM public.notify_stock_alert(_rid, NEW.menu_item_id, _item.name, _new_stock, _item.low_stock_threshold);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_deduct ON public.order_items;
CREATE TRIGGER trg_inventory_deduct
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE PROCEDURE public.handle_inventory_deduct();

-- ============================================================
-- 5. Trigger: Refund stock when an order is cancelled/rejected
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_inventory_refund()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _oi       RECORD;
  _new_stock integer;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('cancelled', 'rejected') THEN RETURN NEW; END IF;

  FOR _oi IN
    SELECT oi.menu_item_id, oi.qty, mi.low_stock_threshold, mi.auto_hide_out_of_stock, mi.name
    FROM public.order_items oi
    JOIN public.menu_items mi ON mi.id = oi.menu_item_id AND mi.track_inventory = true
    WHERE oi.order_id = NEW.id
  LOOP
    UPDATE public.menu_items
      SET stock_quantity = stock_quantity + _oi.qty,
          updated_at     = now()
    WHERE id = _oi.menu_item_id
    RETURNING stock_quantity INTO _new_stock;

    -- Re-show item if it was auto-hidden and now has stock
    IF _oi.auto_hide_out_of_stock AND _new_stock > 0 THEN
      UPDATE public.menu_items SET available = true WHERE id = _oi.menu_item_id;
    END IF;

    INSERT INTO public.inventory_logs (menu_item_id, restaurant_id, change_qty, reason, order_id)
    VALUES (_oi.menu_item_id, NEW.restaurant_id, _oi.qty, 'order_cancelled', NEW.id);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_refund ON public.orders;
CREATE TRIGGER trg_inventory_refund
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE public.handle_inventory_refund();
