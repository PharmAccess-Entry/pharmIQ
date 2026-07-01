-- ============================================================
-- MIGRATION: Harden RLS for Pharmacy Tables
-- Objective: Remove permissive USING(true) policies and enforce
-- strict tenant isolation based on restaurant_id and user roles.
-- ============================================================

-- 1. PATIENTS
DROP POLICY IF EXISTS "permissive_patients" ON public.patients;

CREATE POLICY "patients_select_staff" ON public.patients FOR SELECT 
USING (is_staff(restaurant_id));

CREATE POLICY "patients_insert_staff" ON public.patients FOR INSERT 
WITH CHECK (is_staff(restaurant_id));

CREATE POLICY "patients_update_staff" ON public.patients FOR UPDATE 
USING (is_staff(restaurant_id)) WITH CHECK (is_staff(restaurant_id));

CREATE POLICY "patients_delete_owner" ON public.patients FOR DELETE 
USING (is_owner(restaurant_id));

-- 2. SUPPLIERS
DROP POLICY IF EXISTS "permissive_suppliers" ON public.suppliers;

CREATE POLICY "suppliers_select_staff" ON public.suppliers FOR SELECT 
USING (is_staff(restaurant_id));

CREATE POLICY "suppliers_insert_staff" ON public.suppliers FOR INSERT 
WITH CHECK (is_staff(restaurant_id));

CREATE POLICY "suppliers_update_staff" ON public.suppliers FOR UPDATE 
USING (is_staff(restaurant_id)) WITH CHECK (is_staff(restaurant_id));

CREATE POLICY "suppliers_delete_owner" ON public.suppliers FOR DELETE 
USING (is_owner(restaurant_id));

-- 3. EXPENSES
DROP POLICY IF EXISTS "permissive_expenses" ON public.expenses;

CREATE POLICY "expenses_select_staff" ON public.expenses FOR SELECT 
USING (is_staff(restaurant_id));

CREATE POLICY "expenses_insert_staff" ON public.expenses FOR INSERT 
WITH CHECK (is_staff(restaurant_id));

CREATE POLICY "expenses_update_staff" ON public.expenses FOR UPDATE 
USING (is_staff(restaurant_id)) WITH CHECK (is_staff(restaurant_id));

CREATE POLICY "expenses_delete_owner" ON public.expenses FOR DELETE 
USING (is_owner(restaurant_id));

-- 4. AUDIT LOGS
DROP POLICY IF EXISTS "permissive_audit_logs" ON public.audit_logs;
-- Also drop old permissive policies if they exist from 01_strict_stock_rpc.sql
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.audit_logs;
DROP POLICY IF EXISTS "Enable select for owners only" ON public.audit_logs;

CREATE POLICY "audit_logs_select_staff" ON public.audit_logs FOR SELECT 
USING (is_staff(restaurant_id));

CREATE POLICY "audit_logs_insert_staff" ON public.audit_logs FOR INSERT 
WITH CHECK (is_staff(restaurant_id));

-- No UPDATE or DELETE policies for audit_logs to ensure integrity

-- 5. SHIFTS
DROP POLICY IF EXISTS "permissive_shifts" ON public.shifts;

CREATE POLICY "shifts_select_staff" ON public.shifts FOR SELECT 
USING (is_staff(restaurant_id));

CREATE POLICY "shifts_insert_staff" ON public.shifts FOR INSERT 
WITH CHECK (is_staff(restaurant_id));

CREATE POLICY "shifts_update_staff" ON public.shifts FOR UPDATE 
USING (is_staff(restaurant_id)) WITH CHECK (is_staff(restaurant_id));

CREATE POLICY "shifts_delete_owner" ON public.shifts FOR DELETE 
USING (is_owner(restaurant_id));

-- 6. INVENTORY LOGS
DROP POLICY IF EXISTS "permissive_inventory_logs" ON public.inventory_logs;

CREATE POLICY "inventory_logs_select_staff" ON public.inventory_logs FOR SELECT 
USING (is_staff(restaurant_id));

CREATE POLICY "inventory_logs_insert_staff" ON public.inventory_logs FOR INSERT 
WITH CHECK (is_staff(restaurant_id));

-- No UPDATE or DELETE policies for inventory_logs to ensure ledger integrity
