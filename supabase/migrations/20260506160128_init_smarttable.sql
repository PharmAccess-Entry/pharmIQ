-- Robust nuke: Drop all tables in public schema
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- Drop all functions (optional but recommended for a total wipe)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public') LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.routine_name) || ' CASCADE';
    END LOOP;
END $$;

-- Recreate everything
create extension if not exists pgcrypto;

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  name text not null,
  phone text,
  business_type text,
  table_count integer not null default 0,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  logo_url text,
  base_url text,
  subscription_status text not null default 'trial',
  subscription_plan text,
  subscription_period text,
  trial_ends_at timestamptz,
  active_event_id uuid,
  paystack_reference text,
  last_payment_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  role text not null default 'staff',
  created_at timestamptz not null default now(),
  unique(user_id, restaurant_id)
);

create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  email text not null,
  role text not null default 'staff',
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  description text,
  price numeric not null,
  category text not null,
  image text,
  available boolean not null default true,
  pairs_with uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  event_date date,
  table_count integer not null default 0,
  tier text not null default 'small',
  amount numeric not null default 0,
  payment_status text not null default 'unpaid',
  paystack_reference text,
  qr_enabled boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  short_code text not null,
  table_number text not null,
  intent text not null default 'dine-in',
  status text not null default 'pending',
  total numeric not null default 0,
  customer_name text,
  customer_phone text,
  payment_status text not null default 'unpaid',
  payment_screenshot_url text,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid,
  name text not null,
  qty integer not null,
  price numeric not null,
  item_intent text
);

create table public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender text not null,
  kind text not null default 'message',
  body text,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.customer_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_number text,
  type text not null,
  message text,
  name text,
  phone text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Functions
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger touch_menu_items_updated_at before update on public.menu_items for each row execute procedure public.touch_updated_at();
create trigger touch_events_updated_at before update on public.events for each row execute procedure public.touch_updated_at();
create trigger touch_orders_updated_at before update on public.orders for each row execute procedure public.touch_updated_at();

create or replace function public.handle_new_user_restaurant()
returns trigger language plpgsql security definer as $$
begin
  insert into public.restaurants (owner_id, name, table_count, subscription_status, trial_ends_at)
  values (new.id, coalesce(new.raw_user_meta_data->>'restaurant_name', 'My Business'), 0, 'trial', now() + interval '3 days')
  on conflict do nothing;
  return new;
end $$;

create or replace function public.redeem_staff_invite(_token text)
returns jsonb language plpgsql security definer as $$
declare
  _inv record;
  _user_id uuid;
begin
  _user_id := auth.uid();
  if _user_id is null then raise exception 'Not authenticated'; end if;
  select * into _inv from public.staff_invites where token = _token and accepted_at is null and expires_at > now();
  if not found then raise exception 'Invalid or expired invite'; end if;
  insert into public.user_roles (user_id, restaurant_id, role)
  values (_user_id, _inv.restaurant_id, _inv.role)
  on conflict (user_id, restaurant_id) do update set role = _inv.role;
  update public.staff_invites set accepted_at = now() where id = _inv.id;
  return jsonb_build_object('ok', true, 'restaurant_id', _inv.restaurant_id);
end $$;

-- Policies
alter table public.restaurants enable row level security;
alter table public.user_roles enable row level security;
alter table public.staff_invites enable row level security;
alter table public.menu_items enable row level security;
alter table public.events enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_messages enable row level security;
alter table public.customer_requests enable row level security;
alter table public.notifications enable row level security;

create policy "permissive_restaurants" on public.restaurants for all using (true) with check (true);
create policy "permissive_roles" on public.user_roles for all using (true) with check (true);
create policy "permissive_invites" on public.staff_invites for all using (true) with check (true);
create policy "permissive_menu" on public.menu_items for all using (true) with check (true);
create policy "permissive_events" on public.events for all using (true) with check (true);
create policy "permissive_orders" on public.orders for all using (true) with check (true);
create policy "permissive_items" on public.order_items for all using (true) with check (true);
create policy "permissive_messages" on public.order_messages for all using (true) with check (true);
create policy "permissive_requests" on public.customer_requests for all using (true) with check (true);
create policy "permissive_notifications" on public.notifications for all using (true) with check (true);
