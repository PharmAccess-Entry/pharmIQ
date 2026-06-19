-- Fix staff_id foreign keys to reference auth.users instead of public.user_roles

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_staff_id_fkey,
  ADD CONSTRAINT orders_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_staff_id_fkey,
  ADD CONSTRAINT order_items_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES auth.users(id) ON DELETE SET NULL;
