-- Phase 0: Security Migration Script
-- Restricts authenticated users to their own pharmacy.
-- Leaves anon access open for public routes to prevent breaking QR POS.

-- 1. Restaurants
drop policy if exists "permissive_restaurants" on public.restaurants;
create policy "restaurants_select" on public.restaurants for select using (true);
create policy "restaurants_modify" on public.restaurants for all using (
  auth.uid() IS NOT NULL AND (
    owner_id = auth.uid() or
    id in (select restaurant_id from public.user_roles where user_id = auth.uid())
  )
);

-- 2. User Roles
drop policy if exists "permissive_roles" on public.user_roles;
create policy "roles_select" on public.user_roles for select using (
  auth.uid() IS NOT NULL AND (
    user_id = auth.uid() or
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  )
);
create policy "roles_modify" on public.user_roles for all using (
  auth.uid() IS NOT NULL AND (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  )
);

-- 3. Staff Invites
drop policy if exists "permissive_invites" on public.staff_invites;
create policy "invites_select" on public.staff_invites for select using (
  auth.uid() IS NOT NULL AND (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
    or restaurant_id in (select restaurant_id from public.user_roles where user_id = auth.uid())
  )
);
create policy "invites_modify" on public.staff_invites for all using (
  auth.uid() IS NOT NULL AND (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
    or restaurant_id in (select restaurant_id from public.user_roles where user_id = auth.uid() and role = 'manager')
  )
);

-- 4. Patients
drop policy if exists "permissive_patients" on public.patients;
create policy "patients_select_anon" on public.patients for select using (auth.uid() IS NULL);
create policy "patients_insert_anon" on public.patients for insert with check (auth.uid() IS NULL);
create policy "patients_all_auth" on public.patients for all using (
  auth.uid() IS NOT NULL AND (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
    or restaurant_id in (select restaurant_id from public.user_roles where user_id = auth.uid())
  )
);

-- 5. Menu Items (Products)
drop policy if exists "permissive_menu" on public.menu_items;
create policy "menu_select" on public.menu_items for select using (true);
create policy "menu_modify" on public.menu_items for all using (
  auth.uid() IS NOT NULL AND (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
    or restaurant_id in (select restaurant_id from public.user_roles where user_id = auth.uid())
  )
);

-- 6. Events
drop policy if exists "permissive_events" on public.events;
create policy "events_select" on public.events for select using (true);
create policy "events_modify" on public.events for all using (
  auth.uid() IS NOT NULL AND (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
    or restaurant_id in (select restaurant_id from public.user_roles where user_id = auth.uid())
  )
);

-- 7. Shifts
drop policy if exists "permissive_shifts" on public.shifts;
create policy "shifts_all_auth" on public.shifts for all using (
  auth.uid() IS NOT NULL AND (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
    or restaurant_id in (select restaurant_id from public.user_roles where user_id = auth.uid())
  )
);

-- 8. Orders
drop policy if exists "permissive_orders" on public.orders;
create policy "orders_select_anon" on public.orders for select using (auth.uid() IS NULL);
create policy "orders_insert_anon" on public.orders for insert with check (auth.uid() IS NULL);
create policy "orders_all_auth" on public.orders for all using (
  auth.uid() IS NOT NULL AND (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
    or restaurant_id in (select restaurant_id from public.user_roles where user_id = auth.uid())
  )
);

-- 9. Order Items
drop policy if exists "permissive_items" on public.order_items;
create policy "order_items_select_anon" on public.order_items for select using (auth.uid() IS NULL);
create policy "order_items_insert_anon" on public.order_items for insert with check (auth.uid() IS NULL);
create policy "order_items_all_auth" on public.order_items for all using (
  auth.uid() IS NOT NULL AND (
    order_id in (
      select id from public.orders o where 
        o.restaurant_id in (select restaurant_id from public.user_roles where user_id = auth.uid()) or
        o.restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
    )
  )
);

-- 10. Order Messages
drop policy if exists "permissive_messages" on public.order_messages;
create policy "order_messages_select_anon" on public.order_messages for select using (auth.uid() IS NULL);
create policy "order_messages_insert_anon" on public.order_messages for insert with check (auth.uid() IS NULL);
create policy "order_messages_all_auth" on public.order_messages for all using (
  auth.uid() IS NOT NULL AND (
    order_id in (
      select id from public.orders o where 
        o.restaurant_id in (select restaurant_id from public.user_roles where user_id = auth.uid()) or
        o.restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
    )
  )
);

-- 11. Customer Requests
drop policy if exists "permissive_requests" on public.customer_requests;
create policy "requests_select_anon" on public.customer_requests for select using (auth.uid() IS NULL);
create policy "requests_insert_anon" on public.customer_requests for insert with check (auth.uid() IS NULL);
create policy "requests_all_auth" on public.customer_requests for all using (
  auth.uid() IS NOT NULL AND (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
    or restaurant_id in (select restaurant_id from public.user_roles where user_id = auth.uid())
  )
);

-- 12. Notifications
drop policy if exists "permissive_notifications" on public.notifications;
create policy "notifications_all_auth" on public.notifications for all using (
  auth.uid() IS NOT NULL AND (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
    or restaurant_id in (select restaurant_id from public.user_roles where user_id = auth.uid())
  )
);

-- 13. Inventory Logs
drop policy if exists "permissive_inventory_logs" on public.inventory_logs;
create policy "inventory_logs_all_auth" on public.inventory_logs for all using (
  auth.uid() IS NOT NULL AND (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
    or restaurant_id in (select restaurant_id from public.user_roles where user_id = auth.uid())
  )
);
