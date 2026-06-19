-- ============================================================
-- PharmIQ: Comprehensive Pharmacy Tables Migration
-- Run this ENTIRE script in your Supabase SQL Editor
-- This fixes the P0 schema misalignment identified in the audit
-- ============================================================

-- ============================================================
-- 1. patients table (core pharmacy requirement)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.patients (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id      UUID        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name               TEXT        NOT NULL,
  phone              TEXT        NOT NULL DEFAULT '',
  allergies          TEXT[]      NOT NULL DEFAULT '{}',
  chronic_conditions TEXT[]      NOT NULL DEFAULT '{}',
  last_visit         DATE,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissive_patients" ON public.patients;
CREATE POLICY "permissive_patients" ON public.patients FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_patients_restaurant ON public.patients(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON public.patients(name);

-- ============================================================
-- 2. suppliers table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  contact_name  TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  status        TEXT        NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissive_suppliers" ON public.suppliers;
CREATE POLICY "permissive_suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_suppliers_restaurant ON public.suppliers(restaurant_id);

-- ============================================================
-- 3. expenses table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  description   TEXT        NOT NULL,
  amount        NUMERIC     NOT NULL DEFAULT 0,
  category      TEXT        NOT NULL DEFAULT 'general',
  date          DATE        NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissive_expenses" ON public.expenses;
CREATE POLICY "permissive_expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_expenses_restaurant ON public.expenses(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);

-- ============================================================
-- 4. audit_logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id       UUID,
  action        TEXT        NOT NULL,
  table_name    TEXT,
  record_id     TEXT,
  old_data      JSONB,
  new_data      JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissive_audit_logs" ON public.audit_logs;
CREATE POLICY "permissive_audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant ON public.audit_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================
-- 5. Add patient_id FK to orders (if not already added)
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL;

-- ============================================================
-- 6. Add pharmacy-specific columns to menu_items
-- ============================================================
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS barcode                TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date            DATE,
  ADD COLUMN IF NOT EXISTS batch_number           TEXT,
  ADD COLUMN IF NOT EXISTS requires_prescription  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cost_price             NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS track_inventory        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_quantity         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold    INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS auto_hide_out_of_stock BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 7. Add staff_id to orders and order_items for accountability
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS staff_id UUID;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS staff_id UUID;

-- ============================================================
-- 8. Create shifts table (register management)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shifts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       UUID        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'active',
  start_time          TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time            TIMESTAMPTZ,
  start_cash          NUMERIC     NOT NULL DEFAULT 0,
  expected_cash       NUMERIC     DEFAULT 0,
  actual_cash         NUMERIC,
  expected_pos        NUMERIC     DEFAULT 0,
  actual_pos          NUMERIC,
  expected_transfers  NUMERIC     DEFAULT 0,
  actual_transfers    NUMERIC,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissive_shifts" ON public.shifts;
CREATE POLICY "permissive_shifts" ON public.shifts FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_shifts_restaurant ON public.shifts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user ON public.shifts(user_id);

-- ============================================================
-- 9. inventory_logs table (add if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id   UUID        NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  restaurant_id  UUID        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  change_qty     INTEGER     NOT NULL,
  reason         TEXT        NOT NULL DEFAULT 'manual_adjustment',
  order_id       UUID        REFERENCES public.orders(id) ON DELETE SET NULL,
  note           TEXT,
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissive_inventory_logs" ON public.inventory_logs;
CREATE POLICY "permissive_inventory_logs" ON public.inventory_logs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_menu_item  ON public.inventory_logs(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_restaurant ON public.inventory_logs(restaurant_id);

-- ============================================================
-- 10. Add business_type to restaurants (for pharmacy filtering)
-- ============================================================
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'pharmacy';

-- ============================================================
-- 11. touch_updated_at triggers for new tables
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN new.updated_at = now(); RETURN new; END $$;

DROP TRIGGER IF EXISTS touch_patients_updated_at ON public.patients;
CREATE TRIGGER touch_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER touch_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_shifts_updated_at ON public.shifts;
CREATE TRIGGER touch_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();

-- ============================================================
-- Done! All pharmacy tables are now provisioned.
-- ============================================================
