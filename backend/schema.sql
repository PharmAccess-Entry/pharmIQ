-- ===========================================================================
-- SmartTable Nigeria — Database Schema (PostgreSQL / Supabase)
-- Apply via: Supabase SQL Editor, or `psql -f schema.sql`
-- ===========================================================================

-- 1. ENUMS -------------------------------------------------------------------
create type public.app_role as enum ('owner', 'staff', 'admin');
create type public.order_status as enum ('pending', 'preparing', 'served', 'cancelled');
create type public.subscription_plan as enum ('starter', 'growth', 'pro');
create type public.subscription_status as enum ('active', 'past_due', 'cancelled');

-- 2. RESTAURANTS -------------------------------------------------------------
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  table_count int not null default 5,
  bank_name text,
  account_number text,
  account_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. PROFILES ----------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 4. USER ROLES (separate table — never store roles on profiles) -------------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  role app_role not null,
  unique (user_id, restaurant_id, role)
);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- 5. MENU --------------------------------------------------------------------
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order int default 0
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null,
  image_url text,
  available boolean not null default true,
  created_at timestamptz not null default now()
);

-- 6. TABLES + QR -------------------------------------------------------------
create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_number int not null,
  qr_token text not null unique default encode(gen_random_bytes(12), 'hex'),
  unique (restaurant_id, table_number)
);

-- 7. ORDERS ------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.restaurant_tables(id) on delete restrict,
  status order_status not null default 'pending',
  total numeric(10,2) not null default 0,
  customer_note text,
  placed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  name text not null,           -- snapshot
  unit_price numeric(10,2) not null,
  quantity int not null check (quantity > 0)
);

-- 8. CUSTOMER REQUESTS -------------------------------------------------------
create table public.customer_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.restaurant_tables(id) on delete cascade,
  type text not null check (type in ('call_waiter', 'help', 'complaint')),
  message text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- 9. SUBSCRIPTIONS -----------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  plan subscription_plan not null,
  status subscription_status not null default 'active',
  paystack_ref text,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================
alter table public.restaurants        enable row level security;
alter table public.profiles           enable row level security;
alter table public.user_roles         enable row level security;
alter table public.menu_categories    enable row level security;
alter table public.menu_items         enable row level security;
alter table public.restaurant_tables  enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.customer_requests  enable row level security;
alter table public.subscriptions      enable row level security;

-- helper: is current user a member of restaurant
create or replace function public.is_restaurant_member(_restaurant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.restaurant_id = _restaurant_id
  )
$$;

-- restaurants
create policy "Owners read their restaurant" on public.restaurants
  for select using (owner_id = auth.uid() or public.is_restaurant_member(id));
create policy "Owners insert" on public.restaurants
  for insert with check (owner_id = auth.uid());
create policy "Owners update" on public.restaurants
  for update using (owner_id = auth.uid());

-- profiles
create policy "Users read own profile" on public.profiles for select using (id = auth.uid());
create policy "Users update own profile" on public.profiles for update using (id = auth.uid());
create policy "Users insert own profile" on public.profiles for insert with check (id = auth.uid());

-- user_roles
create policy "Users read own roles" on public.user_roles for select using (user_id = auth.uid());

-- menu (members manage; PUBLIC can read available items via QR)
create policy "Public read available menu" on public.menu_items for select using (available = true);
create policy "Members manage menu" on public.menu_items for all
  using (public.is_restaurant_member(restaurant_id))
  with check (public.is_restaurant_member(restaurant_id));

create policy "Public read categories" on public.menu_categories for select using (true);
create policy "Members manage categories" on public.menu_categories for all
  using (public.is_restaurant_member(restaurant_id))
  with check (public.is_restaurant_member(restaurant_id));

-- tables
create policy "Public read by qr_token" on public.restaurant_tables for select using (true);
create policy "Members manage tables" on public.restaurant_tables for all
  using (public.is_restaurant_member(restaurant_id))
  with check (public.is_restaurant_member(restaurant_id));

-- orders (PUBLIC can insert from QR; members read/update)
create policy "Public can place orders" on public.orders for insert with check (true);
create policy "Members read orders" on public.orders for select using (public.is_restaurant_member(restaurant_id));
create policy "Members update orders" on public.orders for update using (public.is_restaurant_member(restaurant_id));

create policy "Public insert order items" on public.order_items for insert with check (true);
create policy "Members read order items" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and public.is_restaurant_member(o.restaurant_id))
);

-- customer requests
create policy "Public insert requests" on public.customer_requests for insert with check (true);
create policy "Members manage requests" on public.customer_requests for all
  using (public.is_restaurant_member(restaurant_id))
  with check (public.is_restaurant_member(restaurant_id));

-- subscriptions
create policy "Members read subscription" on public.subscriptions for select
  using (public.is_restaurant_member(restaurant_id));

-- ===========================================================================
-- TRIGGERS
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- realtime (orders feed)
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.customer_requests;
