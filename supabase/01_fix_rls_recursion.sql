-- Fix infinite recursion in RLS by using security definer functions for tenant lookups

CREATE OR REPLACE FUNCTION public.is_restaurant_owner(p_restaurant_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.restaurants 
    WHERE id = p_restaurant_id AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_restaurant_staff(p_restaurant_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE restaurant_id = p_restaurant_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_restaurant_manager(p_restaurant_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE restaurant_id = p_restaurant_id AND user_id = auth.uid() AND role = 'manager'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1. Restaurants
drop policy if exists "restaurants_modify" on public.restaurants;
create policy "restaurants_modify" on public.restaurants for all using (
  auth.uid() IS NOT NULL AND (
    owner_id = auth.uid() or
    public.is_restaurant_staff(id)
  )
);

-- 2. User Roles
drop policy if exists "roles_select" on public.user_roles;
create policy "roles_select" on public.user_roles for select using (
  auth.uid() IS NOT NULL AND (
    user_id = auth.uid() or
    public.is_restaurant_owner(restaurant_id)
  )
);

drop policy if exists "roles_modify" on public.user_roles;
create policy "roles_modify" on public.user_roles for all using (
  auth.uid() IS NOT NULL AND (
    public.is_restaurant_owner(restaurant_id)
  )
);

-- 3. Staff Invites
drop policy if exists "invites_select" on public.staff_invites;
create policy "invites_select" on public.staff_invites for select using (
  auth.uid() IS NOT NULL AND (
    public.is_restaurant_owner(restaurant_id) or public.is_restaurant_staff(restaurant_id)
  )
);

drop policy if exists "invites_modify" on public.staff_invites;
create policy "invites_modify" on public.staff_invites for all using (
  auth.uid() IS NOT NULL AND (
    public.is_restaurant_owner(restaurant_id) or public.is_restaurant_manager(restaurant_id)
  )
);

-- 4. Patients
drop policy if exists "patients_all_auth" on public.patients;
create policy "patients_all_auth" on public.patients for all using (
  auth.uid() IS NOT NULL AND (
    public.is_restaurant_owner(restaurant_id) or public.is_restaurant_staff(restaurant_id)
  )
);

-- 5. Menu Items (Products)
drop policy if exists "menu_modify" on public.menu_items;
create policy "menu_modify" on public.menu_items for all using (
  auth.uid() IS NOT NULL AND (
    public.is_restaurant_owner(restaurant_id) or public.is_restaurant_staff(restaurant_id)
  )
);

-- 6. Events
drop policy if exists "events_modify" on public.events;
create policy "events_modify" on public.events for all using (
  auth.uid() IS NOT NULL AND (
    public.is_restaurant_owner(restaurant_id) or public.is_restaurant_staff(restaurant_id)
  )
);

-- 7. Shifts
drop policy if exists "shifts_all_auth" on public.shifts;
create policy "shifts_all_auth" on public.shifts for all using (
  auth.uid() IS NOT NULL AND (
    public.is_restaurant_owner(restaurant_id) or public.is_restaurant_staff(restaurant_id)
  )
);

-- 8. Orders
drop policy if exists "orders_all_auth" on public.orders;
create policy "orders_all_auth" on public.orders for all using (
  auth.uid() IS NOT NULL AND (
    public.is_restaurant_owner(restaurant_id) or public.is_restaurant_staff(restaurant_id)
  )
);

-- 9. Order Items
CREATE OR REPLACE FUNCTION public.is_restaurant_staff_or_owner_for_order(p_order_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = p_order_id AND (
      public.is_restaurant_owner(o.restaurant_id) OR public.is_restaurant_staff(o.restaurant_id)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

drop policy if exists "order_items_all_auth" on public.order_items;
create policy "order_items_all_auth" on public.order_items for all using (
  auth.uid() IS NOT NULL AND public.is_restaurant_staff_or_owner_for_order(order_id)
);

-- 10. Order Messages
drop policy if exists "order_messages_all_auth" on public.order_messages;
create policy "order_messages_all_auth" on public.order_messages for all using (
  auth.uid() IS NOT NULL AND public.is_restaurant_staff_or_owner_for_order(order_id)
);

-- 11. Customer Requests
drop policy if exists "requests_all_auth" on public.customer_requests;
create policy "requests_all_auth" on public.customer_requests for all using (
  auth.uid() IS NOT NULL AND (
    public.is_restaurant_owner(restaurant_id) or public.is_restaurant_staff(restaurant_id)
  )
);

-- 12. Notifications
drop policy if exists "notifications_all_auth" on public.notifications;
create policy "notifications_all_auth" on public.notifications for all using (
  auth.uid() IS NOT NULL AND (
    public.is_restaurant_owner(restaurant_id) or public.is_restaurant_staff(restaurant_id)
  )
);

-- 13. Inventory Logs
drop policy if exists "inventory_logs_all_auth" on public.inventory_logs;
create policy "inventory_logs_all_auth" on public.inventory_logs for all using (
  auth.uid() IS NOT NULL AND (
    public.is_restaurant_owner(restaurant_id) or public.is_restaurant_staff(restaurant_id)
  )
);
