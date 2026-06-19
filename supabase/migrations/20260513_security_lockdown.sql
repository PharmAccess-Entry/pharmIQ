-- Phase 1: Security Lockdown Migration
-- This migration implements strict Row Level Security (RLS) policies and adds performance indexes.

-- 1. CLEANUP: Drop all existing permissive policies
DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    FOR pol IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND policyname LIKE 'permissive_%'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.' || quote_ident(pol.tablename);
    END LOOP;
END $$;

-- 2. HELPER FUNCTIONS (Security Definer to bypass RLS during checks)
CREATE OR REPLACE FUNCTION public.is_owner(_restaurant_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.restaurants 
    WHERE id = _restaurant_id AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_staff(_restaurant_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN (
    EXISTS (SELECT 1 FROM public.restaurants WHERE id = _restaurant_id AND owner_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE restaurant_id = _restaurant_id AND user_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. APPLY POLICIES

-- [restaurants]
-- Customers need to see the restaurant info to use the menu.
DROP POLICY IF EXISTS "restaurants_select_public" ON public.restaurants;
CREATE POLICY "restaurants_select_public" ON public.restaurants FOR SELECT USING (true);
-- Only owners can update their restaurant settings.
DROP POLICY IF EXISTS "restaurants_update_owner" ON public.restaurants;
CREATE POLICY "restaurants_update_owner" ON public.restaurants FOR UPDATE 
USING (is_owner(id)) WITH CHECK (is_owner(id));

-- [user_roles]
-- Staff can see who else works there.
DROP POLICY IF EXISTS "user_roles_select_staff" ON public.user_roles;
CREATE POLICY "user_roles_select_staff" ON public.user_roles FOR SELECT 
USING (is_staff(restaurant_id));
-- Only owners can manage roles.
DROP POLICY IF EXISTS "user_roles_all_owner" ON public.user_roles;
CREATE POLICY "user_roles_all_owner" ON public.user_roles FOR ALL 
USING (is_owner(restaurant_id)) WITH CHECK (is_owner(restaurant_id));

-- [staff_invites]
DROP POLICY IF EXISTS "staff_invites_select_staff" ON public.staff_invites;
CREATE POLICY "staff_invites_select_staff" ON public.staff_invites FOR SELECT 
USING (is_staff(restaurant_id));
DROP POLICY IF EXISTS "staff_invites_all_owner" ON public.staff_invites;
CREATE POLICY "staff_invites_all_owner" ON public.staff_invites FOR ALL 
USING (is_owner(restaurant_id)) WITH CHECK (is_owner(restaurant_id));

-- [menu_items]
-- Public can browse the menu.
DROP POLICY IF EXISTS "menu_items_select_public" ON public.menu_items;
CREATE POLICY "menu_items_select_public" ON public.menu_items FOR SELECT USING (true);
-- Staff can manage menu items.
DROP POLICY IF EXISTS "menu_items_all_staff" ON public.menu_items;
CREATE POLICY "menu_items_all_staff" ON public.menu_items FOR ALL 
USING (is_staff(restaurant_id)) WITH CHECK (is_staff(restaurant_id));

-- [events]
DROP POLICY IF EXISTS "events_select_public" ON public.events;
CREATE POLICY "events_select_public" ON public.events FOR SELECT USING (true);
DROP POLICY IF EXISTS "events_all_staff" ON public.events;
CREATE POLICY "events_all_staff" ON public.events FOR ALL 
USING (is_staff(restaurant_id)) WITH CHECK (is_staff(restaurant_id));

-- [orders]
-- Customers need to track their orders. Staff need to manage them.
DROP POLICY IF EXISTS "orders_select_public" ON public.orders;
CREATE POLICY "orders_select_public" ON public.orders FOR SELECT USING (true);
-- Anyone can place an order.
DROP POLICY IF EXISTS "orders_insert_public" ON public.orders;
CREATE POLICY "orders_insert_public" ON public.orders FOR INSERT WITH CHECK (true);
-- Only staff can update order status/details.
DROP POLICY IF EXISTS "orders_update_staff" ON public.orders;
CREATE POLICY "orders_update_staff" ON public.orders FOR UPDATE 
USING (is_staff(restaurant_id)) WITH CHECK (is_staff(restaurant_id));
-- Only owners can delete orders (for cleanup).
DROP POLICY IF EXISTS "orders_delete_owner" ON public.orders;
CREATE POLICY "orders_delete_owner" ON public.orders FOR DELETE USING (is_owner(restaurant_id));

-- [order_items]
DROP POLICY IF EXISTS "order_items_select_public" ON public.order_items;
CREATE POLICY "order_items_select_public" ON public.order_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "order_items_insert_public" ON public.order_items;
CREATE POLICY "order_items_insert_public" ON public.order_items FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "order_items_all_staff" ON public.order_items;
CREATE POLICY "order_items_all_staff" ON public.order_items FOR ALL 
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND is_staff(o.restaurant_id)));

-- [order_messages]
DROP POLICY IF EXISTS "order_messages_select_public" ON public.order_messages;
CREATE POLICY "order_messages_select_public" ON public.order_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "order_messages_insert_public" ON public.order_messages;
CREATE POLICY "order_messages_insert_public" ON public.order_messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "order_messages_update_staff" ON public.order_messages;
CREATE POLICY "order_messages_update_staff" ON public.order_messages FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND is_staff(o.restaurant_id)));

-- [customer_requests]
DROP POLICY IF EXISTS "customer_requests_insert_public" ON public.customer_requests;
CREATE POLICY "customer_requests_insert_public" ON public.customer_requests FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "customer_requests_select_staff" ON public.customer_requests;
CREATE POLICY "customer_requests_select_staff" ON public.customer_requests FOR SELECT 
USING (is_staff(restaurant_id));
DROP POLICY IF EXISTS "customer_requests_update_staff" ON public.customer_requests;
CREATE POLICY "customer_requests_update_staff" ON public.customer_requests FOR UPDATE 
USING (is_staff(restaurant_id)) WITH CHECK (is_staff(restaurant_id));

-- [notifications]
DROP POLICY IF EXISTS "notifications_insert_public" ON public.notifications;
CREATE POLICY "notifications_insert_public" ON public.notifications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "notifications_select_staff" ON public.notifications;
CREATE POLICY "notifications_select_staff" ON public.notifications FOR SELECT 
USING (is_staff(restaurant_id));
DROP POLICY IF EXISTS "notifications_update_staff" ON public.notifications;
CREATE POLICY "notifications_update_staff" ON public.notifications FOR UPDATE 
USING (is_staff(restaurant_id)) WITH CHECK (is_staff(restaurant_id));


-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON public.restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_restaurant_id ON public.user_roles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON public.menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON public.orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_short_code ON public.orders(short_code);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON public.order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_customer_requests_restaurant_id ON public.customer_requests(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_customer_requests_resolved ON public.customer_requests(resolved);
CREATE INDEX IF NOT EXISTS idx_notifications_restaurant_id ON public.notifications(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_events_restaurant_id ON public.events(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_invites_restaurant_id ON public.staff_invites(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_invites_token ON public.staff_invites(token);
