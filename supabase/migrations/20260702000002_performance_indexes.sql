-- ============================================================
-- MIGRATION: Database Performance Optimization
-- Objective: Add composite indexes for high-volume tables to
-- speed up queries filtering by restaurant and time range.
-- ============================================================

-- Orders table (heavily queried by date range for analytics)
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created_at 
ON public.orders (restaurant_id, created_at DESC);

-- Inventory logs (queried for recent activity and reconciliation)
CREATE INDEX IF NOT EXISTS idx_inventory_logs_restaurant_created_at 
ON public.inventory_logs (restaurant_id, created_at DESC);

-- Audit logs (queried for recent activity)
CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant_created_at 
ON public.audit_logs (restaurant_id, created_at DESC);

-- Expenses (queried by date range for P&L reports)
CREATE INDEX IF NOT EXISTS idx_expenses_restaurant_date 
ON public.expenses (restaurant_id, date DESC);

-- Purchase Orders (queried by date range)
CREATE INDEX IF NOT EXISTS idx_purchase_orders_restaurant_created_at 
ON public.purchase_orders (restaurant_id, created_at DESC);

-- Order Items (queried heavily with joins to orders)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_menu_item_id 
ON public.order_items (order_id, menu_item_id);
